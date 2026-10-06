"""Run the kitchen display backend: `python -m kitchen` (or `kitchen-display`)."""

from __future__ import annotations

import argparse
import logging

import uvicorn

from .app import create_app
from .config import load_config


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Use 0.0.0.0 to reach it from your phone (photo uploads, later).")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--config", help="Path to config.toml (default: $KITCHEN_CONFIG or ./config.toml)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    uvicorn.run(create_app(load_config(args.config)), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
