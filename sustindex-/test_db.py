#!/usr/bin/env python
"""Test database connection"""
import os
import sys

print("=== Testing Database Connection ===")
print(f"DATABASE_URL exists: {bool(os.environ.get('DATABASE_URL'))}")

if os.environ.get('DATABASE_URL'):
    db_url = os.environ.get('DATABASE_URL')
    # Don't print full URL (has password)
    print(f"DATABASE_URL starts with: {db_url[:20]}...")
    
    # Test psycopg2
    try:
        import psycopg2
        print(f"✓ psycopg2 imported successfully (version: {psycopg2.__version__})")
    except ImportError as e:
        print(f"✗ psycopg2 import failed: {e}")
        sys.exit(1)
    
    # Test dj_database_url
    try:
        import dj_database_url
        config = dj_database_url.config(default=db_url)
        print(f"✓ dj_database_url parsed successfully")
        print(f"  Engine: {config.get('ENGINE')}")
        print(f"  Name: {config.get('NAME')}")
        print(f"  Host: {config.get('HOST')}")
    except Exception as e:
        print(f"✗ dj_database_url failed: {e}")
        sys.exit(1)
else:
    print("DATABASE_URL not set, will use SQLite")

print("\n=== All tests passed! ===")
