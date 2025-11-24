from typing import Any, Mapping


def parse_float_arg(args: Mapping[str, Any], key: str, default: float) -> float:
    try:
        raw_value = args.get(key, default)
    except AttributeError:
        return default

    if raw_value in ("", None):
        return default

    try:
        return float(raw_value)
    except (TypeError, ValueError):
        return default


def parse_int_arg(args: Mapping[str, Any], key: str, default: int) -> int:
    try:
        raw_value = args.get(key, default)
    except AttributeError:
        return default

    if raw_value in ("", None):
        return default

    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return default


def json_float(payload: Mapping[str, Any], key: str, default: float) -> float:
    try:
        raw_value = payload.get(key, default)
    except AttributeError:
        return default

    if raw_value in ("", None):
        return default

    try:
        return float(raw_value)
    except (TypeError, ValueError):
        return default


def json_int(payload: Mapping[str, Any], key: str, default: int) -> int:
    try:
        raw_value = payload.get(key, default)
    except AttributeError:
        return default

    if raw_value in ("", None):
        return default

    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return default
