"""
ML Engine Services Package

This package contains service modules for ML Engine.
Following microservices architecture principles.
"""

from .backend_api_client import BackendAPIClient, get_client

__all__ = ['BackendAPIClient', 'get_client']
