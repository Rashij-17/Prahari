"""
Prahari — Pharmacy Scraper Service
===================================
Provides dynamic background scraping of Indian online pharmacies (Tata 1mg)
and caches results to the local SQLite database.
"""

import os
import re
import sqlite3
import asyncio
import logging
from typing import Optional, Tuple, List, Dict

import httpx

logger = logging.getLogger("uvicorn")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "indian_medicines.db")


def parse_compositions(drug_name: str, strength: Optional[str]) -> Tuple[str, str]:
    """
    Pairs compositions with strengths.
    e.g. drug_name="Amoxycillin + Clavulanic Acid", strength="500mg+125mg"
    returns ("Amoxycillin (500mg)", "Clavulanic Acid (125mg)")
    """
    if not drug_name:
        return "", ""

    # Split by +
    comps = [c.strip() for c in re.split(r'\s*\+\s*', drug_name) if c.strip()]
    strengths = []
    if strength:
        strengths = [s.strip() for s in re.split(r'\s*\+\s*', strength) if s.strip()]

    comp_parsed = []
    for i, comp in enumerate(comps):
        if i < len(strengths):
            comp_parsed.append(f"{comp} ({strengths[i]})")
        else:
            comp_parsed.append(comp)

    comp1 = comp_parsed[0] if len(comp_parsed) > 0 else ""
    comp2 = comp_parsed[1] if len(comp_parsed) > 1 else ""

    return comp1, comp2


def clean_scraped_name(label: Optional[str], name: Optional[str]) -> str:
    """Strips any HTML formatting from scraped labels."""
    val = label or name or ""
    # Strip HTML tags
    val = re.sub(r'<[^>]*>', '', val)
    return val.strip()


def sync_cache_scraped_drugs(drugs: List[Dict]) -> None:
    """Synchronous caching of drugs in the SQLite database."""
    if not os.path.exists(DB_PATH):
        logger.error("Database file not found at %s", DB_PATH)
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        for d in drugs:
            name = d.get("name")
            if not name:
                continue

            price = d.get("price", 0.0) or 0.0
            manufacturer = d.get("manufacturer") or ""
            pack_size = d.get("pack_size") or ""
            comp1 = d.get("comp1") or ""
            comp2 = d.get("comp2") or ""

            # Check if this brand exists (case-insensitive)
            cursor.execute("SELECT id FROM medicines WHERE name = ? COLLATE NOCASE", (name,))
            row = cursor.fetchone()
            if row:
                # Update existing record
                cursor.execute("""
                    UPDATE medicines
                    SET price = ?, manufacturer_name = ?, pack_size_label = ?, short_composition1 = ?, short_composition2 = ?, is_discontinued = 0
                    WHERE id = ?
                """, (price, manufacturer, pack_size, comp1, comp2, row[0]))
                logger.info("Updated cached drug: %s (ID: %d, Price: %.2f)", name, row[0], price)
            else:
                # Insert new record
                cursor.execute("""
                    INSERT INTO medicines (name, price, manufacturer_name, type, pack_size_label, short_composition1, short_composition2, is_discontinued)
                    VALUES (?, ?, ?, 'allopathy', ?, ?, ?, 0)
                """, (name, price, manufacturer, pack_size, comp1, comp2))
                logger.info("Inserted new cached drug: %s (Price: %.2f)", name, price)
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("Error caching scraped drugs: %s", e)
        raise e
    finally:
        conn.close()


async def cache_scraped_drugs(drugs: List[Dict]) -> None:
    """Asynchronous wrapper for caching drugs."""
    await asyncio.to_thread(sync_cache_scraped_drugs, drugs)


async def scrape_brand_details(brand_name: str) -> List[Dict]:
    """Scrapes drug details from Tata 1mg Suggest API."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://www.1mg.com/api/v1/search/suggest",
                params={"name": brand_name},
                headers=headers,
                timeout=10.0
            )
            if response.status_code != 200:
                logger.warning("1mg suggest API returned status %d for '%s'", response.status_code, brand_name)
                return []

            data = response.json()
            results = data.get("results", [])
            parsed_drugs = []

            for item in results:
                if item.get("type") == "drug":
                    name = clean_scraped_name(item.get("label"), item.get("name"))
                    if not name:
                        continue

                    price = item.get("price")
                    if price is None:
                        price = item.get("discounted_price") or 0.0

                    manufacturer = item.get("manufacturer_name") or item.get("marketer_name") or ""
                    pack_size = item.get("pack_size_label") or ""

                    drug_name_val = item.get("drug_name") or ""
                    strength_val = item.get("strength")

                    comp1, comp2 = parse_compositions(drug_name_val, strength_val)

                    parsed_drugs.append({
                        "name": name,
                        "price": float(price),
                        "manufacturer": manufacturer,
                        "pack_size": pack_size,
                        "comp1": comp1,
                        "comp2": comp2
                    })
            return parsed_drugs
        except Exception as e:
            logger.error("Error scraping brand details for '%s': %s", brand_name, e)
            return []


async def scrape_and_cache_brand(brand_name: str) -> bool:
    """Scrapes brand details and saves them to local SQLite."""
    logger.info("Scraping and caching brand: '%s'", brand_name)
    drugs = await scrape_brand_details(brand_name)
    if not drugs:
        logger.info("No drug suggestions found for brand: '%s'", brand_name)
        return False

    await cache_scraped_drugs(drugs)
    return True
