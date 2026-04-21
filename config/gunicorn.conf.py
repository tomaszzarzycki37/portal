# Gunicorn Configuration File

import multiprocessing
import os

# Server socket
bind = "127.0.0.1:8000"  # Change to 0.0.0.0:8000 if not using reverse proxy
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'sync'
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = '/var/log/gunicorn/access.log'
errorlog = '/var/log/gunicorn/error.log'
loglevel = 'info'

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Process naming
proc_name = 'chinese_cars_portal'

# Server mechanics
daemon = False
pidfile = '/run/gunicorn/gunicorn.pid'
umask = 0
user = None
group = None

# Server hooks
def on_starting(server):
    print("Gunicorn server is starting...")

def when_ready(server):
    print("Gunicorn server is ready. Spawning workers")

def on_exit(server):
    print("Gunicorn server is shutting down...")
