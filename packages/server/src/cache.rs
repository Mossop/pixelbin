use std::{
    borrow::Borrow,
    collections::HashMap,
    hash::Hash,
    sync::Arc,
    time::{Duration, Instant},
};

use tokio::sync::Mutex;

fn flush<K, V>(map: &mut HashMap<K, (Instant, V)>) {}

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
}

impl<K, V> Cache<K, V>
where
    K: Eq + Hash,
    V: Clone + Default,
{
    pub(crate) async fn get<Q>(&self, key: Q) -> V
    where
        Q: ToOwned<Owned = K>,
    {
        let mut map = self.map.lock().await;
        flush(&mut map);

        let newttl = Instant::now() + self.ttl;

        map.entry(key.to_owned())
            .and_modify(|val| {
                val.0 = newttl;
            })
            .or_insert_with(|| (newttl, V::default()))
            .1
            .clone()
    }
}
