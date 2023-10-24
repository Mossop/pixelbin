use std::{
    borrow::Borrow,
    collections::HashMap,
    hash::Hash,
    sync::Arc,
    time::{Duration, Instant},
};

use tokio::sync::Mutex;

fn flush<K, V>(_map: &mut HashMap<K, (Instant, V)>) {}

#[derive(Clone)]
pub(crate) struct Cache<K, V> {
    ttl: Duration,
    map: Arc<Mutex<HashMap<K, (Instant, V)>>>,
}

impl<K, V> Cache<K, V> {
    pub(crate) fn new(ttl: Duration) -> Self {
        Self {
            ttl,
            map: Default::default(),
        }
    }
}

impl<K, V> Cache<K, V>
where
    K: Eq + Hash,
{
    pub(crate) async fn contains_key<Q>(&self, key: &Q) -> bool
    where
        K: Borrow<Q>,
        Q: Hash + Eq + ?Sized,
    {
        let map = self.map.lock().await;

        map.contains_key(key)
    }

    pub(crate) async fn insert(&self, key: K, value: V) {
        let mut map = self.map.lock().await;
        map.insert(key, (Instant::now() + self.ttl, value));
    }

    pub(crate) async fn delete(&self, key: &K) {
        let mut map = self.map.lock().await;
        map.remove(key);
    }
}

impl<K, V> Cache<K, V>
where
    K: Eq + Hash,
    V: Clone,
{
    pub(crate) async fn get(&self, key: &K) -> Option<V> {
        let mut map = self.map.lock().await;
        flush(&mut map);

        map.get_mut(key).map(|val| {
            val.0 = Instant::now() + self.ttl;
            val.1.clone()
        })
    }
}

impl<K, V> Cache<K, V>
where
    K: Eq + Hash + Clone,
    V: Clone + From<K>,
{
    pub(crate) async fn get_or_create(&self, key: &K) -> V {
        let mut map = self.map.lock().await;
        flush(&mut map);

        let newttl = Instant::now() + self.ttl;

        map.entry(key.to_owned())
            .and_modify(|val| {
                val.0 = newttl;
            })
            .or_insert_with(|| (newttl, key.to_owned().into()))
            .1
            .clone()
    }

    pub(crate) async fn update<F>(&self, key: &K, cb: F) -> V
    where
        F: FnOnce(&mut V),
    {
        let mut map = self.map.lock().await;

        let newttl = Instant::now() + self.ttl;

        if let Some(value) = map.get_mut(key) {
            cb(&mut value.1);
            value.0 = newttl;
            value.1.clone()
        } else {
            let mut item = key.to_owned().into();
            cb(&mut item);
            map.insert(key.clone(), (newttl, item.clone()));
            item
        }
    }
}
