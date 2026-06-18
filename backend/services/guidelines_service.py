import logging
from sqlalchemy.orm import Session
from models.db import DBClinicalSafetyRule

logger = logging.getLogger(__name__)

# List of pre-seeded clinical rules
CORE_RULES = [
    # --- Drug-Drug Interactions ---
    {
        "ingredient_name": "warfarin",
        "trigger_type": "drug",
        "value_match": "ibuprofen",
        "warning_text": "Taking Ibuprofen with Warfarin increases your risk of severe stomach bleeding. Avoid NSAIDs unless directed by a doctor.",
        "severity": "critical",
    },
    {
        "ingredient_name": "warfarin",
        "trigger_type": "drug",
        "value_match": "aspirin",
        "warning_text": "Combined use of Aspirin and Warfarin significantly increases the risk of major bleeding. Use with extreme caution.",
        "severity": "critical",
    },
    {
        "ingredient_name": "aspirin",
        "trigger_type": "drug",
        "value_match": "ibuprofen",
        "warning_text": "Ibuprofen can decrease the heart-protective effect of low-dose Aspirin. Space these medications or consult your doctor.",
        "severity": "warning",
    },
    {
        "ingredient_name": "lisinopril",
        "trigger_type": "drug",
        "value_match": "spironolactone",
        "warning_text": "Combined use may lead to dangerously high potassium levels in the blood (hyperkalemia). Monitor potassium levels.",
        "severity": "warning",
    },
    {
        "ingredient_name": "sildenafil",
        "trigger_type": "drug",
        "value_match": "nitroglycerin",
        "warning_text": "Taking Sildenafil (Viagra) with Nitroglycerin can cause a life-threatening, sudden drop in blood pressure. DO NOT take together.",
        "severity": "critical",
    },
    # --- Drug-Allergy Interactions ---
    {
        "ingredient_name": "amoxicillin",
        "trigger_type": "allergy",
        "value_match": "penicillin",
        "warning_text": "Amoxicillin belongs to the penicillin class. Since you are allergic to penicillin, taking this medication may trigger a severe, life-threatening allergic reaction (anaphylaxis).",
        "severity": "critical",
    },
    {
        "ingredient_name": "piperacillin",
        "trigger_type": "allergy",
        "value_match": "penicillin",
        "warning_text": "Piperacillin belongs to the penicillin class. Do not take if you have a documented penicillin allergy.",
        "severity": "critical",
    },
    {
        "ingredient_name": "cephalexin",
        "trigger_type": "allergy",
        "value_match": "penicillin",
        "warning_text": "Cephalexin is a cephalosporin. Patients with severe penicillin allergy may experience allergic cross-reactivity. Use with caution.",
        "severity": "warning",
    },
    {
        "ingredient_name": "ibuprofen",
        "trigger_type": "allergy",
        "value_match": "nsaid",
        "warning_text": "Since you are allergic to NSAIDs, taking Ibuprofen (which is an NSAID) may trigger hives, facial swelling, or breathing difficulty.",
        "severity": "critical",
    },
    # --- Drug-Lab / Condition Interactions ---
    {
        "ingredient_name": "metformin",
        "trigger_type": "lab",
        "value_match": "creatinine: high",
        "warning_text": "High creatinine levels indicate impaired kidney function. Taking Metformin with kidney impairment increases the risk of a rare but serious condition called lactic acidosis.",
        "severity": "critical",
    },
    {
        "ingredient_name": "metformin",
        "trigger_type": "lab",
        "value_match": "kidney",
        "warning_text": "Impaired kidney function increases the risk of Metformin-induced lactic acidosis. Monitor kidney markers closely.",
        "severity": "critical",
    },
    {
        "ingredient_name": "pseudoephedrine",
        "trigger_type": "lab",
        "value_match": "hypertension",
        "warning_text": "Pseudoephedrine is a decongestant that constricts blood vessels and increases blood pressure. Avoid if you have uncontrolled high blood pressure.",
        "severity": "warning",
    },
    {
        "ingredient_name": "pseudoephedrine",
        "trigger_type": "lab",
        "value_match": "blood pressure: high",
        "warning_text": "Pseudoephedrine can increase blood pressure. Avoid if you have high blood pressure.",
        "severity": "warning",
    },
    {
        "ingredient_name": "atorvastatin",
        "trigger_type": "lab",
        "value_match": "liver",
        "warning_text": "Atorvastatin can affect liver function. Avoid if you have active liver disease or unexplained elevations in liver enzymes.",
        "severity": "warning",
    },
    {
        "ingredient_name": "amoxicillin",
        "trigger_type": "drug",
        "value_match": "allopurinol",
        "warning_text": "Taking Allopurinol with Amoxicillin (Augmentin) significantly increases the risk of developing a skin rash. Use with caution.",
        "severity": "warning",
    },
    {
        "ingredient_name": "amoxicillin",
        "trigger_type": "drug",
        "value_match": "methotrexate",
        "warning_text": "Amoxicillin can decrease the renal clearance of Methotrexate, leading to dangerously elevated Methotrexate levels and severe toxicity. Avoid concurrent use.",
        "severity": "critical",
    },
    {
        "ingredient_name": "paracetamol",
        "trigger_type": "drug",
        "value_match": "warfarin",
        "warning_text": "Regular or prolonged use of Paracetamol (Calpol) can increase the blood-thinning effect of Warfarin, raising your risk of bleeding. Monitor your INR closely.",
        "severity": "warning",
    },
]


def seed_clinical_rules(db: Session):
    """
    Seeds the clinical_safety_rules table with core drug, allergy, and lab warnings.
    """
    try:
        logger.info("Syncing clinical safety rules database...")
        # Clear existing rules to ensure any updates/additions in CORE_RULES are applied
        db.query(DBClinicalSafetyRule).delete()
        for rule in CORE_RULES:
            db_rule = DBClinicalSafetyRule(
                ingredient_name=rule["ingredient_name"].lower().strip(),
                trigger_type=rule["trigger_type"].strip(),
                value_match=rule["value_match"].lower().strip(),
                warning_text=rule["warning_text"].strip(),
                severity=rule["severity"].strip(),
            )
            db.add(db_rule)
        db.commit()
        logger.info("Successfully synced clinical safety rules.")
    except Exception as e:
        logger.error("Failed to seed clinical safety rules: %s", e)
        db.rollback()


def extract_active_ingredients(generic_name: str) -> list[str]:
    """
    Extracts individual active ingredients from a combined drug generic name.
    E.g., "Montelukast Sodium + Levocetirizine Dihydrochloride" -> ["montelukast", "levocetirizine"]
    """
    if not generic_name:
        return []
    
    # Clean and split common separators
    raw_parts = [generic_name]
    for sep in ["+", "and", "/", ","]:
        new_parts = []
        for part in raw_parts:
            new_parts.extend(part.split(sep))
        raw_parts = new_parts

    ingredients = []
    for part in raw_parts:
        cleaned = part.lower().strip()
        
        # Remove trailing numbers or strengths first
        import re
        cleaned = re.sub(r'\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g)\b', '', cleaned)
        cleaned = cleaned.strip()
        
        # Remove common salt suffixes iteratively
        suffixes = [
            " sodium", " hydrochloride", " dihydrochloride", " maleate",
            " phosphate", " sulfate", " potassium", " calcium", " ip", " bp", " usp"
        ]
        changed = True
        while changed:
            changed = False
            for suffix in suffixes:
                if cleaned.endswith(suffix):
                    cleaned = cleaned[:-len(suffix)].strip()
                    changed = True
        
        if cleaned:
            ingredients.append(cleaned)
            
    return list(set(ingredients))


def check_local_safety_rules(
    db: Session,
    active_ingredients: list[str],
    user_allergies: list[str],
    user_labs: list[str],
) -> list[dict]:
    """
    Evaluates the active ingredients list against local database safety rules.
    Checks:
      1. Drug-Drug (within the list)
      2. Drug-Allergy (ingredients vs allergies list)
      3. Drug-Lab (ingredients vs lab/condition list)
    
    Returns:
        list[dict]: List of triggered warnings with details (rule_type, warning_text, severity, matched_value).
    """
    warnings = []
    
    # Normalize inputs
    user_allergies_norm = [a.lower().strip() for a in user_allergies if a]
    user_labs_norm = [l.lower().strip() for l in user_labs if l]
    
    # 1. Drug-Drug Interactions
    # Check all pairs (A, B) within active ingredients
    if len(active_ingredients) > 1:
        for i in range(len(active_ingredients)):
            for j in range(i + 1, len(active_ingredients)):
                ing_a = active_ingredients[i].lower().strip()
                ing_b = active_ingredients[j].lower().strip()
                
                # Check DB for rules matching (A, B) or (B, A)
                rules = db.query(DBClinicalSafetyRule).filter(
                    DBClinicalSafetyRule.trigger_type == "drug",
                    (
                        (DBClinicalSafetyRule.ingredient_name == ing_a) & (DBClinicalSafetyRule.value_match == ing_b)
                    ) | (
                        (DBClinicalSafetyRule.ingredient_name == ing_b) & (DBClinicalSafetyRule.value_match == ing_a)
                    )
                ).all()
                
                for r in rules:
                    warnings.append({
                        "rule_type": "drug_interaction",
                        "warning_text": r.warning_text,
                        "severity": r.severity,
                        "matched_value": f"{ing_a.capitalize()} + {ing_b.capitalize()}"
                    })

    # 2. Drug-Allergy Interactions
    for ing in active_ingredients:
        ing_clean = ing.lower().strip()
        # Find allergy rules for this ingredient
        rules = db.query(DBClinicalSafetyRule).filter(
            DBClinicalSafetyRule.trigger_type == "allergy",
            DBClinicalSafetyRule.ingredient_name == ing_clean
        ).all()
        
        for r in rules:
            val_match = r.value_match.lower().strip()
            # Check if any user allergy contains or matches the rule's value_match
            for user_allergy in user_allergies_norm:
                if val_match in user_allergy or user_allergy in val_match:
                    warnings.append({
                        "rule_type": "allergy_conflict",
                        "warning_text": r.warning_text,
                        "severity": r.severity,
                        "matched_value": user_allergy.capitalize()
                    })
                    break

    # 3. Drug-Lab / Condition Interactions
    for ing in active_ingredients:
        ing_clean = ing.lower().strip()
        # Find lab rules for this ingredient
        rules = db.query(DBClinicalSafetyRule).filter(
            DBClinicalSafetyRule.trigger_type == "lab",
            DBClinicalSafetyRule.ingredient_name == ing_clean
        ).all()
        
        for r in rules:
            val_match = r.value_match.lower().strip()
            # Check if any user lab/condition matches
            for user_lab in user_labs_norm:
                if val_match in user_lab or user_lab in val_match:
                    warnings.append({
                        "rule_type": "condition_conflict",
                        "warning_text": r.warning_text,
                        "severity": r.severity,
                        "matched_value": user_lab.capitalize()
                    })
                    break

    # Deduplicate warnings
    seen_warnings = set()
    deduped = []
    for w in warnings:
        key = (w["rule_type"], w["warning_text"])
        if key not in seen_warnings:
            seen_warnings.add(key)
            deduped.append(w)
            
    return deduped
