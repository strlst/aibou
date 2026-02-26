#!/bin/sh -x
ENV_FILE=.env
if [ ! -f "$ENV_FILE" ]; then
    echo "FLASK_SECRET=$(openssl rand -hex 32)" > "$ENV_FILE"
fi
