import pytest
from app.services.catalog_store import catalog_store
from app.services.catalog_test_fixtures import FIXTURE_PRODUCTS, FIXTURE_INVENTORY, FIXTURE_MOVEMENTS

@pytest.fixture(autouse=True)
def setup_catalog_test_fixtures():
    """
    Ensure test fixtures exist during pytest test executions.
    This fixture runs ONLY during pytest and never in production uvicorn runtime.
    """
    for k, v in FIXTURE_PRODUCTS.items():
        if k not in catalog_store.products:
            catalog_store.products[k] = dict(v)
    for k, v in FIXTURE_INVENTORY.items():
        if k not in catalog_store.inventory:
            catalog_store.inventory[k] = dict(v)
    yield
