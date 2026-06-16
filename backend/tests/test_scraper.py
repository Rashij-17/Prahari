import os
import sqlite3
import pytest
import httpx
from fastapi.testclient import TestClient

from main import app
from services import scraper_service
from services.scraper_service import (
    parse_compositions,
    clean_scraped_name,
    scrape_brand_details,
    scrape_and_cache_brand,
)

client = TestClient(app)


def test_parse_compositions():
    # Single composition
    assert parse_compositions("Paracetamol", "650mg") == ("Paracetamol (650mg)", "")
    assert parse_compositions("Paracetamol", None) == ("Paracetamol", "")
    assert parse_compositions("Paracetamol", "") == ("Paracetamol", "")

    # Multi composition
    assert parse_compositions(
        "Amoxycillin + Clavulanic Acid", "500mg+125mg"
    ) == ("Amoxycillin (500mg)", "Clavulanic Acid (125mg)")

    # Unbalanced lists
    assert parse_compositions("Paracetamol + Caffeine", "500mg") == (
        "Paracetamol (500mg)",
        "Caffeine",
    )
    assert parse_compositions("", "500mg") == ("", "")


def test_clean_scraped_name():
    assert clean_scraped_name("<b>Dolo</b> 650", None) == "Dolo 650"
    assert clean_scraped_name(None, "<b>Calpol 500</b>") == "Calpol 500"
    assert clean_scraped_name(None, None) == ""


@pytest.mark.asyncio
async def test_scrape_brand_details_success(mocker):
    mock_resp = mocker.MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "results": [
            {
                "type": "drug",
                "label": "Dolo 650 Tablet",
                "price": 32.13,
                "manufacturer_name": "MICRO LABS LIMITED",
                "pack_size_label": "strip of 15 tablets",
                "drug_name": "Paracetamol",
                "strength": "650mg",
            },
            {
                "type": "query_suggestion",
                "label": "Dolo 650",
            },
        ]
    }

    mocker.patch("httpx.AsyncClient.get", return_value=mock_resp)

    drugs = await scrape_brand_details("dolo 650")
    assert len(drugs) == 1
    assert drugs[0]["name"] == "Dolo 650 Tablet"
    assert drugs[0]["price"] == 32.13
    assert drugs[0]["manufacturer"] == "MICRO LABS LIMITED"
    assert drugs[0]["pack_size"] == "strip of 15 tablets"
    assert drugs[0]["comp1"] == "Paracetamol (650mg)"
    assert drugs[0]["comp2"] == ""


@pytest.mark.asyncio
async def test_scrape_brand_details_empty_or_error(mocker):
    # Mock error response
    mock_resp_err = mocker.MagicMock(spec=httpx.Response)
    mock_resp_err.status_code = 500
    mocker.patch("httpx.AsyncClient.get", return_value=mock_resp_err)

    drugs = await scrape_brand_details("error")
    assert drugs == []

    # Mock invalid JSON
    mock_resp_bad = mocker.MagicMock(spec=httpx.Response)
    mock_resp_bad.status_code = 200
    mock_resp_bad.json.side_effect = Exception("invalid json")
    mocker.patch("httpx.AsyncClient.get", return_value=mock_resp_bad)

    drugs_bad = await scrape_brand_details("bad_json")
    assert drugs_bad == []


def test_db_caching(tmp_path):
    # Setup temp DB file
    temp_db = tmp_path / "temp_medicines.db"
    conn = sqlite3.connect(temp_db)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            is_discontinued BOOLEAN,
            manufacturer_name TEXT,
            type TEXT,
            pack_size_label TEXT,
            short_composition1 TEXT,
            short_composition2 TEXT
        );
    """)
    # Insert a dummy record
    cursor.execute("""
        INSERT INTO medicines (name, price, manufacturer_name, type, pack_size_label, short_composition1, short_composition2, is_discontinued)
        VALUES ('Test Dolo 650', 30.0, 'MICRO LABS', 'allopathy', 'strip of 15', 'Paracetamol (650mg)', '', 0)
    """)
    conn.commit()
    conn.close()

    # Override scraper DB_PATH
    original_db_path = scraper_service.DB_PATH
    scraper_service.DB_PATH = str(temp_db)

    try:
        # 1. Update existing drug
        drugs_update = [{
            "name": "Test Dolo 650",
            "price": 35.5,
            "manufacturer": "MICRO LABS UPDATED",
            "pack_size": "strip of 10",
            "comp1": "Paracetamol (650mg)",
            "comp2": "Caffeine"
        }]
        scraper_service.sync_cache_scraped_drugs(drugs_update)

        # Verify update
        conn = sqlite3.connect(temp_db)
        cursor = conn.cursor()
        cursor.execute("SELECT price, manufacturer_name, pack_size_label, short_composition2 FROM medicines WHERE name = 'Test Dolo 650'")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == 35.5
        assert row[1] == "MICRO LABS UPDATED"
        assert row[2] == "strip of 10"
        assert row[3] == "Caffeine"

        # 2. Insert new drug
        drugs_insert = [{
            "name": "New Scraped Drug 100",
            "price": 150.0,
            "manufacturer": "GSK",
            "pack_size": "strip of 10",
            "comp1": "Amoxycillin (500mg)",
            "comp2": ""
        }]
        scraper_service.sync_cache_scraped_drugs(drugs_insert)

        cursor.execute("SELECT price, manufacturer_name FROM medicines WHERE name = 'New Scraped Drug 100'")
        row_new = cursor.fetchone()
        assert row_new is not None
        assert row_new[0] == 150.0
        assert row_new[1] == "GSK"
        conn.close()

    finally:
        scraper_service.DB_PATH = original_db_path


@pytest.mark.asyncio
async def test_router_miss_fallback_trigger(mocker, tmp_path):
    # Setup temp DB
    temp_db = tmp_path / "temp_med_router.db"
    conn = sqlite3.connect(temp_db)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            is_discontinued BOOLEAN,
            manufacturer_name TEXT,
            type TEXT,
            pack_size_label TEXT,
            short_composition1 TEXT,
            short_composition2 TEXT
        );
    """)
    conn.commit()
    conn.close()

    # Mock DB path in medication router & scraper service
    import routers.medication as med_router
    mocker.patch.object(med_router, "DB_PATH", str(temp_db))
    mocker.patch.object(scraper_service, "DB_PATH", str(temp_db))

    # Mock scrape_brand_details to return a mock list of drugs
    mock_scraped = [{
        "name": "BrandNewDrug Tablet",
        "price": 85.0,
        "manufacturer": "Cipla",
        "pack_size": "strip of 10",
        "comp1": "Paracetamol (650mg)",
        "comp2": ""
    }]
    mocker.patch("services.scraper_service.scrape_brand_details", return_value=mock_scraped)

    # Mock RxNorm / openFDA calls so they don't hit real APIs
    mocker.patch("routers.medication.resolve_name_to_rxcui", return_value=None)
    mocker.patch("routers.medication.get_drug_profile_by_name", return_value=None)

    # Trigger profile fetch for a non-existent brand (miss)
    response = client.get("/medication/profile?name=BrandNewDrug")
    # It should trigger scrape, cache in DB, and then find it in SQLite
    # It will fallback to returning the local clinical profile fallback (Status 200)
    assert response.status_code == 200
    data = response.json()
    assert data["brand_name"] == "BrandNewDrug Tablet"
    assert data["price"] == 85.0
    assert data["manufacturer"] == "Cipla"
    assert "Paracetamol (650mg)" in data["generic_name"]


@pytest.mark.asyncio
async def test_router_search_miss_trigger(mocker, tmp_path):
    # Setup temp DB
    temp_db = tmp_path / "temp_med_router_search.db"
    conn = sqlite3.connect(temp_db)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            is_discontinued BOOLEAN,
            manufacturer_name TEXT,
            type TEXT,
            pack_size_label TEXT,
            short_composition1 TEXT,
            short_composition2 TEXT
        );
    """)
    conn.commit()
    conn.close()

    import routers.medication as med_router
    mocker.patch.object(med_router, "DB_PATH", str(temp_db))
    mocker.patch.object(scraper_service, "DB_PATH", str(temp_db))

    # Mock scrape_brand_details to return a mock list of drugs
    mock_scraped = [{
        "name": "ScrapedSearchDrug Tablet",
        "price": 45.0,
        "manufacturer": "Cipla",
        "pack_size": "strip of 10",
        "comp1": "Paracetamol (650mg)",
        "comp2": ""
    }]
    mocker.patch("services.scraper_service.scrape_brand_details", return_value=mock_scraped)

    # Mock RxNorm / openFDA calls
    mocker.patch("routers.medication.expand_search_query", return_value=[])

    # Trigger search for a non-existent brand (miss)
    response = client.get("/medication/search?q=ScrapedSearchDrug")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) > 0
    assert data["results"][0]["name"] == "ScrapedSearchDrug Tablet"
    assert data["source"] in ("local_indian_db", "combined")

