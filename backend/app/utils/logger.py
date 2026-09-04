# # app/utils/logger.py

# import logging
# from logging.handlers import TimedRotatingFileHandler
# import os

# LOG_DIR = "logs"

# if not os.path.exists(LOG_DIR):
#     os.makedirs(LOG_DIR)

# def get_logger(name="app"):
#     logger = logging.getLogger(name)

#     if logger.handlers:
#         return logger  # Prevent duplicate logs

#     logger.setLevel(logging.INFO)

#     log_file = os.path.join(LOG_DIR, "app.log")

#     handler = TimedRotatingFileHandler(
#         log_file,
#         when="midnight",
#         interval=1,
#         backupCount=15,    # Keep last 15 days logs
#         encoding="utf-8"
#     )

#     formatter = logging.Formatter(
#         "[%(asctime)s] [%(levelname)s] %(message)s"
#     )
#     handler.setFormatter(formatter)

#     logger.addHandler(handler)
#     logger.propagate = False

#     return logger



import logging
from logging.handlers import TimedRotatingFileHandler
import os

LOG_DIR = "logs"

if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

def get_logger(name="app"):
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger  # prevent duplicate handlers

    logger.setLevel(logging.INFO)

    log_file = os.path.join(LOG_DIR, f"{name}.log")

    handler = TimedRotatingFileHandler(
        log_file,
        when="midnight",
        interval=1,
        backupCount=1,
        encoding="utf-8"
    )

    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] %(message)s"
    )

    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.propagate = False  # do NOT show logs in terminal

    return logger
