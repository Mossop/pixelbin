use serde_json::{Map, Value};

const TYPE_NULL: &str = "null";
const TYPE_BOOL: &str = "boolean";
const TYPE_NUMBER: &str = "number";
const TYPE_STRING: &str = "string";
const TYPE_ARRAY: &str = "array";
const TYPE_OBJECT: &str = "object";

pub(super) type Object = Map<String, Value>;

pub(super) fn type_of(value: &Value) -> &'static str {
    match value {
        Value::Null => TYPE_NULL,
        Value::Bool(_) => TYPE_BOOL,
        Value::Number(_) => TYPE_NUMBER,
        Value::String(_) => TYPE_STRING,
        Value::Array(_) => TYPE_ARRAY,
        Value::Object(_) => TYPE_OBJECT,
    }
}

pub(super) fn expect_object(val: &Value) -> Option<&Object> {
    if let Value::Object(obj) = val {
        Some(obj)
    } else {
        None
    }
}

pub(super) fn expect_prop<'a, 'b>(
    prop: &'a str,
) -> impl FnOnce(&'b Object) -> Option<&'b Value> + 'a {
    |obj: &Object| obj.get(prop)
}

pub(super) fn expect_string(val: &Value) -> Option<String> {
    match val {
        Value::String(ref str) => {
            if str.is_empty() {
                None
            } else {
                Some(str.clone())
            }
        }
        Value::Number(ref num) => Some(num.to_string()),
        _ => None,
    }
}

pub(super) fn expect_string_list(val: &Value) -> Option<String> {
    match val {
        Value::Array(ref array) => {
            let strings = array
                .iter()
                .filter_map(expect_string)
                .collect::<Vec<String>>();

            if strings.is_empty() {
                None
            } else {
                Some(strings.join(", "))
            }
        }
        Value::String(ref str) => {
            if str.is_empty() {
                None
            } else {
                Some(str.clone())
            }
        }
        Value::Number(ref num) => Some(num.to_string()),
        _ => None,
    }
}

pub(super) fn expect_object_array(val: &Value) -> Option<Vec<&Object>> {
    match val {
        Value::Array(ref array) => {
            let objs = array
                .iter()
                .filter_map(expect_object)
                .collect::<Vec<&Object>>();

            if objs.is_empty() {
                None
            } else {
                Some(objs)
            }
        }
        _ => None,
    }
}

pub(super) fn expect_float(val: &Value) -> Option<f32> {
    match val {
        Value::String(ref str) => str.parse::<f32>().ok(),
        Value::Number(ref num) => num.as_f64().map(|f| f as f32),
        _ => None,
    }
}

pub(super) fn expect_int(val: &Value) -> Option<i32> {
    match val {
        Value::String(ref str) => str.parse::<i32>().ok(),
        Value::Number(ref num) => num.as_i64().map(|f| f as i32),
        _ => None,
    }
}

pub(super) fn first<F>(list: Vec<&Object>, cb: F) -> Option<&Object>
where
    F: FnMut(&&Object) -> bool,
{
    list.into_iter().find(cb)
}

macro_rules! map {
    ($first:expr, $($others:expr),+ $(,)*) => {
        $first$(.and_then($others))+
    }
}

macro_rules! first_of {
    ($first:expr, $($others:expr),+ $(,)*) => {
        $first$(.or_else(|| $others))+
    }
}

macro_rules! prop {
    ($obj:expr, $prop:expr) => {
        $obj.get($prop)
    };
    ($obj:expr, $prop:expr, $($props:expr),+ $(,)*) => {
        $obj.get($prop)
            $(.and_then(crate::metadata::json::expect_object).and_then(crate::metadata::json::expect_prop($props)))+
    };
}

pub(super) use first_of;
pub(super) use map;
pub(super) use prop;
