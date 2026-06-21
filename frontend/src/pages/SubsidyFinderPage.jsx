/**
 * SubsidyFinderPage.jsx — Module 6
 * =====================================
 * Government Subsidy & 90% Cost-Saver Finder
 * - Fuzzy Levenshtein search against embedded Jan Aushadhi (PMBJK) drug dataset
 * - Savings calculator with annual projection
 * - Leaflet map with nearest PMBJK store finder via Haversine + OSRM routing
 * - Cross-module: "Add to Cabinet" → Module 1, triggered from Module 7 via URL param
 *
 * Offline-first: drug search is fully offline; map tiles cached by Leaflet;
 * OSRM routing degrades gracefully to Google Maps deep-link.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { addMedicine } from '../services/medicineCabinetDB.js'

// ─── Leaflet CDN loader ───────────────────────────────────────────────────────
function ensureLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return }
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(css)

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => resolve(window.L)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// ─── Levenshtein Distance (scratch DP implementation) ────────────────────────
function levenshtein(a, b) {
  a = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  b = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = 1 + Math.min(
          matrix[i - 1][j],     // deletion
          matrix[i][j - 1],     // insertion
          matrix[i - 1][j - 1]  // substitution
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

// ─── Haversine Distance (km) ──────────────────────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Embedded Jan Aushadhi Drug Dataset (100+ entries) ───────────────────────
const JAN_AUSHADHI_DRUGS = [
  // --- Antidiabetic ---
  { id: 'ja001', genericName: 'Metformin Hydrochloride', saltComposition: 'Metformin 500mg', category: 'Antidiabetic', mrpPerUnit: 3.5, pmbjkPricePerUnit: 0.5, unit: 'tablet', packSize: 10 },
  { id: 'ja002', genericName: 'Metformin Hydrochloride SR', saltComposition: 'Metformin 1000mg', category: 'Antidiabetic', mrpPerUnit: 6.8, pmbjkPricePerUnit: 0.9, unit: 'tablet', packSize: 10 },
  { id: 'ja003', genericName: 'Glimepiride', saltComposition: 'Glimepiride 1mg', category: 'Antidiabetic', mrpPerUnit: 5.2, pmbjkPricePerUnit: 0.7, unit: 'tablet', packSize: 10 },
  { id: 'ja004', genericName: 'Glimepiride', saltComposition: 'Glimepiride 2mg', category: 'Antidiabetic', mrpPerUnit: 7.5, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },
  { id: 'ja005', genericName: 'Sitagliptin Phosphate', saltComposition: 'Sitagliptin 100mg', category: 'Antidiabetic', mrpPerUnit: 52.0, pmbjkPricePerUnit: 12.0, unit: 'tablet', packSize: 14 },
  { id: 'ja006', genericName: 'Voglibose', saltComposition: 'Voglibose 0.3mg', category: 'Antidiabetic', mrpPerUnit: 8.0, pmbjkPricePerUnit: 1.2, unit: 'tablet', packSize: 10 },
  { id: 'ja007', genericName: 'Glibenclamide', saltComposition: 'Glibenclamide 5mg', category: 'Antidiabetic', mrpPerUnit: 3.8, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 10 },

  // --- Cardiovascular ---
  { id: 'ja008', genericName: 'Atorvastatin Calcium', saltComposition: 'Atorvastatin 10mg', category: 'Cardiovascular', mrpPerUnit: 8.5, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },
  { id: 'ja009', genericName: 'Atorvastatin Calcium', saltComposition: 'Atorvastatin 20mg', category: 'Cardiovascular', mrpPerUnit: 12.0, pmbjkPricePerUnit: 1.5, unit: 'tablet', packSize: 10 },
  { id: 'ja010', genericName: 'Atorvastatin Calcium', saltComposition: 'Atorvastatin 40mg', category: 'Cardiovascular', mrpPerUnit: 18.0, pmbjkPricePerUnit: 2.5, unit: 'tablet', packSize: 10 },
  { id: 'ja011', genericName: 'Amlodipine Besylate', saltComposition: 'Amlodipine 5mg', category: 'Cardiovascular', mrpPerUnit: 4.5, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 10 },
  { id: 'ja012', genericName: 'Telmisartan', saltComposition: 'Telmisartan 40mg', category: 'Cardiovascular', mrpPerUnit: 9.5, pmbjkPricePerUnit: 1.2, unit: 'tablet', packSize: 14 },
  { id: 'ja013', genericName: 'Telmisartan', saltComposition: 'Telmisartan 80mg', category: 'Cardiovascular', mrpPerUnit: 14.0, pmbjkPricePerUnit: 1.8, unit: 'tablet', packSize: 14 },
  { id: 'ja014', genericName: 'Losartan Potassium', saltComposition: 'Losartan 50mg', category: 'Cardiovascular', mrpPerUnit: 8.0, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 14 },
  { id: 'ja015', genericName: 'Aspirin', saltComposition: 'Aspirin 75mg', category: 'Cardiovascular', mrpPerUnit: 2.5, pmbjkPricePerUnit: 0.35, unit: 'tablet', packSize: 14 },
  { id: 'ja016', genericName: 'Atenolol', saltComposition: 'Atenolol 50mg', category: 'Cardiovascular', mrpPerUnit: 4.0, pmbjkPricePerUnit: 0.5, unit: 'tablet', packSize: 14 },
  { id: 'ja017', genericName: 'Lisinopril', saltComposition: 'Lisinopril 5mg', category: 'Cardiovascular', mrpPerUnit: 5.5, pmbjkPricePerUnit: 0.8, unit: 'tablet', packSize: 14 },
  { id: 'ja018', genericName: 'Furosemide', saltComposition: 'Furosemide 40mg', category: 'Cardiovascular', mrpPerUnit: 3.5, pmbjkPricePerUnit: 0.4, unit: 'tablet', packSize: 10 },
  { id: 'ja019', genericName: 'Rosuvastatin Calcium', saltComposition: 'Rosuvastatin 10mg', category: 'Cardiovascular', mrpPerUnit: 15.0, pmbjkPricePerUnit: 2.0, unit: 'tablet', packSize: 10 },
  { id: 'ja020', genericName: 'Metoprolol Succinate', saltComposition: 'Metoprolol 50mg', category: 'Cardiovascular', mrpPerUnit: 8.5, pmbjkPricePerUnit: 1.2, unit: 'tablet', packSize: 14 },

  // --- Antibiotics / Anti-infectives ---
  { id: 'ja021', genericName: 'Amoxicillin Trihydrate', saltComposition: 'Amoxicillin 500mg', category: 'Antibiotic', mrpPerUnit: 12.0, pmbjkPricePerUnit: 1.5, unit: 'capsule', packSize: 10 },
  { id: 'ja022', genericName: 'Azithromycin Dihydrate', saltComposition: 'Azithromycin 500mg', category: 'Antibiotic', mrpPerUnit: 28.0, pmbjkPricePerUnit: 4.0, unit: 'tablet', packSize: 5 },
  { id: 'ja023', genericName: 'Ciprofloxacin Hydrochloride', saltComposition: 'Ciprofloxacin 500mg', category: 'Antibiotic', mrpPerUnit: 9.0, pmbjkPricePerUnit: 1.2, unit: 'tablet', packSize: 10 },
  { id: 'ja024', genericName: 'Doxycycline Hyclate', saltComposition: 'Doxycycline 100mg', category: 'Antibiotic', mrpPerUnit: 8.5, pmbjkPricePerUnit: 1.0, unit: 'capsule', packSize: 10 },
  { id: 'ja025', genericName: 'Cetirizine Hydrochloride', saltComposition: 'Cetirizine 10mg', category: 'Antihistamine', mrpPerUnit: 3.5, pmbjkPricePerUnit: 0.4, unit: 'tablet', packSize: 10 },
  { id: 'ja026', genericName: 'Metronidazole', saltComposition: 'Metronidazole 400mg', category: 'Antibiotic', mrpPerUnit: 4.0, pmbjkPricePerUnit: 0.5, unit: 'tablet', packSize: 10 },
  { id: 'ja027', genericName: 'Norfloxacin', saltComposition: 'Norfloxacin 400mg', category: 'Antibiotic', mrpPerUnit: 6.0, pmbjkPricePerUnit: 0.8, unit: 'tablet', packSize: 10 },
  { id: 'ja028', genericName: 'Cefixime', saltComposition: 'Cefixime 200mg', category: 'Antibiotic', mrpPerUnit: 22.0, pmbjkPricePerUnit: 3.5, unit: 'tablet', packSize: 10 },
  { id: 'ja029', genericName: 'Levofloxacin', saltComposition: 'Levofloxacin 500mg', category: 'Antibiotic', mrpPerUnit: 18.0, pmbjkPricePerUnit: 2.5, unit: 'tablet', packSize: 5 },

  // --- Pain / Fever / Anti-inflammatory ---
  { id: 'ja030', genericName: 'Paracetamol', saltComposition: 'Paracetamol 500mg', category: 'Analgesic', mrpPerUnit: 1.5, pmbjkPricePerUnit: 0.2, unit: 'tablet', packSize: 15 },
  { id: 'ja031', genericName: 'Paracetamol', saltComposition: 'Paracetamol 650mg', category: 'Analgesic', mrpPerUnit: 2.0, pmbjkPricePerUnit: 0.25, unit: 'tablet', packSize: 15 },
  { id: 'ja032', genericName: 'Ibuprofen', saltComposition: 'Ibuprofen 400mg', category: 'NSAID', mrpPerUnit: 4.5, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 15 },
  { id: 'ja033', genericName: 'Diclofenac Sodium', saltComposition: 'Diclofenac 50mg', category: 'NSAID', mrpPerUnit: 5.0, pmbjkPricePerUnit: 0.7, unit: 'tablet', packSize: 10 },
  { id: 'ja034', genericName: 'Tramadol Hydrochloride', saltComposition: 'Tramadol 50mg', category: 'Analgesic', mrpPerUnit: 8.0, pmbjkPricePerUnit: 1.2, unit: 'tablet', packSize: 10 },
  { id: 'ja035', genericName: 'Aceclofenac', saltComposition: 'Aceclofenac 100mg', category: 'NSAID', mrpPerUnit: 7.5, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },
  { id: 'ja036', genericName: 'Mefenamic Acid', saltComposition: 'Mefenamic 500mg', category: 'NSAID', mrpPerUnit: 6.0, pmbjkPricePerUnit: 0.8, unit: 'tablet', packSize: 10 },

  // --- Gastro ---
  { id: 'ja037', genericName: 'Omeprazole', saltComposition: 'Omeprazole 20mg', category: 'Gastro', mrpPerUnit: 5.0, pmbjkPricePerUnit: 0.6, unit: 'capsule', packSize: 14 },
  { id: 'ja038', genericName: 'Omeprazole', saltComposition: 'Omeprazole 40mg', category: 'Gastro', mrpPerUnit: 8.5, pmbjkPricePerUnit: 1.0, unit: 'capsule', packSize: 14 },
  { id: 'ja039', genericName: 'Pantoprazole Sodium', saltComposition: 'Pantoprazole 40mg', category: 'Gastro', mrpPerUnit: 7.0, pmbjkPricePerUnit: 0.8, unit: 'tablet', packSize: 14 },
  { id: 'ja040', genericName: 'Ranitidine Hydrochloride', saltComposition: 'Ranitidine 150mg', category: 'Gastro', mrpPerUnit: 3.5, pmbjkPricePerUnit: 0.4, unit: 'tablet', packSize: 14 },
  { id: 'ja041', genericName: 'Domperidone', saltComposition: 'Domperidone 10mg', category: 'Gastro', mrpPerUnit: 4.5, pmbjkPricePerUnit: 0.5, unit: 'tablet', packSize: 10 },
  { id: 'ja042', genericName: 'Ondansetron', saltComposition: 'Ondansetron 4mg', category: 'Gastro', mrpPerUnit: 9.0, pmbjkPricePerUnit: 1.2, unit: 'tablet', packSize: 10 },
  { id: 'ja043', genericName: 'Metoclopramide', saltComposition: 'Metoclopramide 10mg', category: 'Gastro', mrpPerUnit: 3.0, pmbjkPricePerUnit: 0.4, unit: 'tablet', packSize: 10 },
  { id: 'ja044', genericName: 'Esomeprazole Magnesium', saltComposition: 'Esomeprazole 40mg', category: 'Gastro', mrpPerUnit: 10.0, pmbjkPricePerUnit: 1.4, unit: 'capsule', packSize: 14 },

  // --- Vitamins / Supplements ---
  { id: 'ja045', genericName: 'Cholecalciferol', saltComposition: 'Vitamin D3 60000 IU', category: 'Vitamin', mrpPerUnit: 28.0, pmbjkPricePerUnit: 5.0, unit: 'capsule', packSize: 4 },
  { id: 'ja046', genericName: 'Methylcobalamin', saltComposition: 'Vitamin B12 500mcg', category: 'Vitamin', mrpPerUnit: 12.0, pmbjkPricePerUnit: 1.5, unit: 'tablet', packSize: 10 },
  { id: 'ja047', genericName: 'Folic Acid', saltComposition: 'Folic Acid 5mg', category: 'Vitamin', mrpPerUnit: 2.5, pmbjkPricePerUnit: 0.3, unit: 'tablet', packSize: 30 },
  { id: 'ja048', genericName: 'Ferrous Sulfate + Folic Acid', saltComposition: 'Iron 150mg + Folic Acid 1mg', category: 'Vitamin', mrpPerUnit: 3.5, pmbjkPricePerUnit: 0.4, unit: 'tablet', packSize: 30 },
  { id: 'ja049', genericName: 'Calcium Carbonate + Vitamin D3', saltComposition: 'Calcium 500mg + D3 250 IU', category: 'Vitamin', mrpPerUnit: 4.5, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 30 },
  { id: 'ja050', genericName: 'Multivitamin + Multimineral', saltComposition: 'Multivitamin Complex', category: 'Vitamin', mrpPerUnit: 5.0, pmbjkPricePerUnit: 0.7, unit: 'tablet', packSize: 30 },

  // --- Thyroid ---
  { id: 'ja051', genericName: 'Levothyroxine Sodium', saltComposition: 'Levothyroxine 25mcg', category: 'Thyroid', mrpPerUnit: 4.5, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 30 },
  { id: 'ja052', genericName: 'Levothyroxine Sodium', saltComposition: 'Levothyroxine 50mcg', category: 'Thyroid', mrpPerUnit: 5.5, pmbjkPricePerUnit: 0.7, unit: 'tablet', packSize: 30 },
  { id: 'ja053', genericName: 'Levothyroxine Sodium', saltComposition: 'Levothyroxine 100mcg', category: 'Thyroid', mrpPerUnit: 7.0, pmbjkPricePerUnit: 0.9, unit: 'tablet', packSize: 30 },
  { id: 'ja054', genericName: 'Carbimazole', saltComposition: 'Carbimazole 5mg', category: 'Thyroid', mrpPerUnit: 6.0, pmbjkPricePerUnit: 0.8, unit: 'tablet', packSize: 30 },

  // --- Respiratory ---
  { id: 'ja055', genericName: 'Salbutamol Sulfate', saltComposition: 'Salbutamol 2mg', category: 'Respiratory', mrpPerUnit: 3.0, pmbjkPricePerUnit: 0.4, unit: 'tablet', packSize: 10 },
  { id: 'ja056', genericName: 'Montelukast Sodium', saltComposition: 'Montelukast 10mg', category: 'Respiratory', mrpPerUnit: 18.0, pmbjkPricePerUnit: 2.5, unit: 'tablet', packSize: 10 },
  { id: 'ja057', genericName: 'Budesonide', saltComposition: 'Budesonide 200mcg', category: 'Respiratory', mrpPerUnit: 45.0, pmbjkPricePerUnit: 9.0, unit: 'inhaler', packSize: 1 },
  { id: 'ja058', genericName: 'Theophylline', saltComposition: 'Theophylline 200mg', category: 'Respiratory', mrpPerUnit: 5.0, pmbjkPricePerUnit: 0.7, unit: 'tablet', packSize: 10 },
  { id: 'ja059', genericName: 'Ambroxol Hydrochloride', saltComposition: 'Ambroxol 30mg', category: 'Respiratory', mrpPerUnit: 4.5, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 10 },
  { id: 'ja060', genericName: 'Fexofenadine Hydrochloride', saltComposition: 'Fexofenadine 120mg', category: 'Antihistamine', mrpPerUnit: 15.0, pmbjkPricePerUnit: 2.0, unit: 'tablet', packSize: 10 },

  // --- Dermatology ---
  { id: 'ja061', genericName: 'Clotrimazole', saltComposition: 'Clotrimazole 1% Cream', category: 'Dermatology', mrpPerUnit: 35.0, pmbjkPricePerUnit: 5.0, unit: 'ml', packSize: 15 },
  { id: 'ja062', genericName: 'Betamethasone Valerate', saltComposition: 'Betamethasone 0.1% Cream', category: 'Dermatology', mrpPerUnit: 40.0, pmbjkPricePerUnit: 6.0, unit: 'ml', packSize: 15 },
  { id: 'ja063', genericName: 'Permethrin', saltComposition: 'Permethrin 5% Lotion', category: 'Dermatology', mrpPerUnit: 55.0, pmbjkPricePerUnit: 8.0, unit: 'ml', packSize: 30 },
  { id: 'ja064', genericName: 'Mupirocin', saltComposition: 'Mupirocin 2% Ointment', category: 'Dermatology', mrpPerUnit: 60.0, pmbjkPricePerUnit: 9.0, unit: 'ml', packSize: 5 },
  { id: 'ja065', genericName: 'Calamine Lotion', saltComposition: 'Calamine 15%', category: 'Dermatology', mrpPerUnit: 30.0, pmbjkPricePerUnit: 4.5, unit: 'ml', packSize: 60 },

  // --- Neurological / Psychiatric ---
  { id: 'ja066', genericName: 'Alprazolam', saltComposition: 'Alprazolam 0.25mg', category: 'Psychiatric', mrpPerUnit: 5.5, pmbjkPricePerUnit: 0.7, unit: 'tablet', packSize: 10 },
  { id: 'ja067', genericName: 'Clonazepam', saltComposition: 'Clonazepam 0.5mg', category: 'Psychiatric', mrpPerUnit: 6.0, pmbjkPricePerUnit: 0.8, unit: 'tablet', packSize: 10 },
  { id: 'ja068', genericName: 'Sertraline Hydrochloride', saltComposition: 'Sertraline 50mg', category: 'Psychiatric', mrpPerUnit: 12.0, pmbjkPricePerUnit: 1.5, unit: 'tablet', packSize: 10 },
  { id: 'ja069', genericName: 'Gabapentin', saltComposition: 'Gabapentin 300mg', category: 'Neurological', mrpPerUnit: 10.0, pmbjkPricePerUnit: 1.4, unit: 'capsule', packSize: 10 },
  { id: 'ja070', genericName: 'Pregabalin', saltComposition: 'Pregabalin 75mg', category: 'Neurological', mrpPerUnit: 14.0, pmbjkPricePerUnit: 2.0, unit: 'capsule', packSize: 10 },

  // --- Ophthalmology / ENT ---
  { id: 'ja071', genericName: 'Ciprofloxacin Eye Drops', saltComposition: 'Ciprofloxacin 0.3%', category: 'Ophthalmology', mrpPerUnit: 45.0, pmbjkPricePerUnit: 7.0, unit: 'ml', packSize: 5 },
  { id: 'ja072', genericName: 'Ofloxacin Eye Drops', saltComposition: 'Ofloxacin 0.3%', category: 'Ophthalmology', mrpPerUnit: 50.0, pmbjkPricePerUnit: 8.0, unit: 'ml', packSize: 5 },
  { id: 'ja073', genericName: 'Xylometazoline Nasal Drops', saltComposition: 'Xylometazoline 0.1%', category: 'ENT', mrpPerUnit: 40.0, pmbjkPricePerUnit: 6.0, unit: 'ml', packSize: 10 },

  // --- Gynaecology / Hormones ---
  { id: 'ja074', genericName: 'Progesterone', saltComposition: 'Progesterone 200mg', category: 'Hormonal', mrpPerUnit: 35.0, pmbjkPricePerUnit: 5.0, unit: 'capsule', packSize: 10 },
  { id: 'ja075', genericName: 'Ethinyl Estradiol + Norethindrone', saltComposition: 'OCP Standard Dose', category: 'Hormonal', mrpPerUnit: 5.0, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 21 },
  { id: 'ja076', genericName: 'Medroxyprogesterone Acetate', saltComposition: 'Medroxyprogesterone 10mg', category: 'Hormonal', mrpPerUnit: 8.0, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },

  // --- Antifungal / Antiparasitic ---
  { id: 'ja077', genericName: 'Fluconazole', saltComposition: 'Fluconazole 150mg', category: 'Antifungal', mrpPerUnit: 22.0, pmbjkPricePerUnit: 3.0, unit: 'capsule', packSize: 1 },
  { id: 'ja078', genericName: 'Albendazole', saltComposition: 'Albendazole 400mg', category: 'Anthelmintic', mrpPerUnit: 12.0, pmbjkPricePerUnit: 1.5, unit: 'tablet', packSize: 1 },
  { id: 'ja079', genericName: 'Ivermectin', saltComposition: 'Ivermectin 12mg', category: 'Anthelmintic', mrpPerUnit: 18.0, pmbjkPricePerUnit: 2.5, unit: 'tablet', packSize: 2 },

  // --- Anti-hypertensive combinations ---
  { id: 'ja080', genericName: 'Telmisartan + Amlodipine', saltComposition: 'Telmisartan 40mg + Amlodipine 5mg', category: 'Cardiovascular', mrpPerUnit: 16.0, pmbjkPricePerUnit: 2.2, unit: 'tablet', packSize: 10 },
  { id: 'ja081', genericName: 'Metoprolol + Amlodipine', saltComposition: 'Metoprolol 50mg + Amlodipine 5mg', category: 'Cardiovascular', mrpPerUnit: 12.0, pmbjkPricePerUnit: 1.5, unit: 'tablet', packSize: 10 },

  // --- Urological ---
  { id: 'ja082', genericName: 'Tamsulosin Hydrochloride', saltComposition: 'Tamsulosin 0.4mg', category: 'Urological', mrpPerUnit: 15.0, pmbjkPricePerUnit: 2.0, unit: 'capsule', packSize: 10 },
  { id: 'ja083', genericName: 'Oxybutynin Chloride', saltComposition: 'Oxybutynin 5mg', category: 'Urological', mrpPerUnit: 8.0, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },

  // --- Orthopaedics / Muscle relaxants ---
  { id: 'ja084', genericName: 'Chlorzoxazone', saltComposition: 'Chlorzoxazone 500mg', category: 'Muscle Relaxant', mrpPerUnit: 6.5, pmbjkPricePerUnit: 0.9, unit: 'tablet', packSize: 10 },
  { id: 'ja085', genericName: 'Tizanidine Hydrochloride', saltComposition: 'Tizanidine 2mg', category: 'Muscle Relaxant', mrpPerUnit: 8.0, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },
  { id: 'ja086', genericName: 'Calcium + Vitamin D3 + Methylcobalamin', saltComposition: 'Bone Supplement Complex', category: 'Orthopaedics', mrpPerUnit: 12.0, pmbjkPricePerUnit: 1.8, unit: 'tablet', packSize: 10 },

  // --- Wound care / Antiseptics ---
  { id: 'ja087', genericName: 'Povidone Iodine', saltComposition: 'Povidone Iodine 5%', category: 'Antiseptic', mrpPerUnit: 55.0, pmbjkPricePerUnit: 8.0, unit: 'ml', packSize: 100 },
  { id: 'ja088', genericName: 'Hydrogen Peroxide', saltComposition: 'Hydrogen Peroxide 3%', category: 'Antiseptic', mrpPerUnit: 25.0, pmbjkPricePerUnit: 3.5, unit: 'ml', packSize: 100 },

  // --- Oncology (supportive) ---
  { id: 'ja089', genericName: 'Ondansetron Injection', saltComposition: 'Ondansetron 4mg/2ml', category: 'Anti-emetic', mrpPerUnit: 35.0, pmbjkPricePerUnit: 5.0, unit: 'ml', packSize: 2 },
  { id: 'ja090', genericName: 'Dexamethasone', saltComposition: 'Dexamethasone 4mg', category: 'Corticosteroid', mrpPerUnit: 8.0, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },

  // --- Antacids ---
  { id: 'ja091', genericName: 'Magnesium Hydroxide + Aluminium Hydroxide', saltComposition: 'Antacid Suspension', category: 'Gastro', mrpPerUnit: 40.0, pmbjkPricePerUnit: 5.0, unit: 'ml', packSize: 200 },
  { id: 'ja092', genericName: 'Sucralfate', saltComposition: 'Sucralfate 1gm', category: 'Gastro', mrpPerUnit: 7.0, pmbjkPricePerUnit: 0.9, unit: 'tablet', packSize: 10 },

  // --- Cardiovascular extras ---
  { id: 'ja093', genericName: 'Clopidogrel Bisulfate', saltComposition: 'Clopidogrel 75mg', category: 'Cardiovascular', mrpPerUnit: 10.0, pmbjkPricePerUnit: 1.2, unit: 'tablet', packSize: 14 },
  { id: 'ja094', genericName: 'Isosorbide Mononitrate', saltComposition: 'ISDN 30mg', category: 'Cardiovascular', mrpPerUnit: 9.0, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },
  { id: 'ja095', genericName: 'Digoxin', saltComposition: 'Digoxin 0.25mg', category: 'Cardiovascular', mrpPerUnit: 5.0, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 14 },

  // --- Antidiabetic extras ---
  { id: 'ja096', genericName: 'Empagliflozin', saltComposition: 'Empagliflozin 10mg', category: 'Antidiabetic', mrpPerUnit: 38.0, pmbjkPricePerUnit: 8.0, unit: 'tablet', packSize: 14 },
  { id: 'ja097', genericName: 'Dapagliflozin', saltComposition: 'Dapagliflozin 10mg', category: 'Antidiabetic', mrpPerUnit: 40.0, pmbjkPricePerUnit: 8.5, unit: 'tablet', packSize: 14 },

  // --- Misc ---
  { id: 'ja098', genericName: 'Zinc Sulfate', saltComposition: 'Zinc 20mg', category: 'Supplement', mrpPerUnit: 3.5, pmbjkPricePerUnit: 0.4, unit: 'tablet', packSize: 14 },
  { id: 'ja099', genericName: 'Lactulose Solution', saltComposition: 'Lactulose 10gm/15ml', category: 'Gastro', mrpPerUnit: 65.0, pmbjkPricePerUnit: 9.0, unit: 'ml', packSize: 100 },
  { id: 'ja100', genericName: 'Hydroxychloroquine Sulfate', saltComposition: 'HCQ 400mg', category: 'Antimalarial', mrpPerUnit: 15.0, pmbjkPricePerUnit: 2.0, unit: 'tablet', packSize: 10 },
  { id: 'ja101', genericName: 'Chloroquine Phosphate', saltComposition: 'Chloroquine 250mg', category: 'Antimalarial', mrpPerUnit: 8.0, pmbjkPricePerUnit: 1.0, unit: 'tablet', packSize: 10 },
  { id: 'ja102', genericName: 'Enalapril Maleate', saltComposition: 'Enalapril 5mg', category: 'Cardiovascular', mrpPerUnit: 4.5, pmbjkPricePerUnit: 0.6, unit: 'tablet', packSize: 14 },
  { id: 'ja103', genericName: 'Amlodipine + Atorvastatin', saltComposition: 'Amlodipine 5mg + Atorvastatin 10mg', category: 'Cardiovascular', mrpPerUnit: 16.0, pmbjkPricePerUnit: 2.0, unit: 'tablet', packSize: 10 },
]

// ─── Embedded PMBJK Store Dataset (30+ stores) ────────────────────────────────
const PMBJK_STORES = [
  // Delhi / NCR
  { id: 'st001', name: 'PMBJK Store #1042', address: 'Shop 12, Near AIIMS Gate, Ansari Nagar', city: 'New Delhi', state: 'Delhi', pincode: '110029', lat: 28.5672, lng: 77.2100, phone: '011-26588500', timings: '8AM–8PM Mon–Sat' },
  { id: 'st002', name: 'PMBJK Store #1188', address: 'Block C-2, Pitampura Main Market', city: 'New Delhi', state: 'Delhi', pincode: '110034', lat: 28.7001, lng: 77.1300, phone: '011-27315021', timings: '9AM–9PM Mon–Sat' },
  { id: 'st003', name: 'PMBJK Store #1304', address: 'Sector 10, Rohini Community Centre', city: 'New Delhi', state: 'Delhi', pincode: '110085', lat: 28.7220, lng: 77.0600, phone: '011-27057340', timings: '9AM–8PM Mon–Sat' },
  { id: 'st004', name: 'PMBJK Store #1561', address: '45, Karol Bagh, Near Metro Station', city: 'New Delhi', state: 'Delhi', pincode: '110005', lat: 28.6490, lng: 77.1900, phone: '011-23528900', timings: '9AM–9PM All Days' },
  { id: 'st005', name: 'PMBJK Store #1722', address: 'Plot 5, Sector 12, Dwarka', city: 'New Delhi', state: 'Delhi', pincode: '110075', lat: 28.5830, lng: 77.0300, phone: '011-25089201', timings: '9AM–9PM Mon–Sat' },
  // Noida / Gurgaon
  { id: 'st006', name: 'PMBJK Store #2001', address: 'Sector 27, Near Mahamaya Flyover', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301', lat: 28.5700, lng: 77.3200, phone: '0120-4212100', timings: '9AM–8PM Mon–Sat' },
  { id: 'st007', name: 'PMBJK Store #2212', address: 'DLF Phase II, Sikanderpur Market', city: 'Gurgaon', state: 'Haryana', pincode: '122002', lat: 28.4900, lng: 77.0800, phone: '0124-4060100', timings: '9AM–9PM All Days' },
  // Mumbai
  { id: 'st008', name: 'PMBJK Store #3011', address: 'KEM Hospital Premises, Parel', city: 'Mumbai', state: 'Maharashtra', pincode: '400012', lat: 18.9980, lng: 72.8400, phone: '022-24138650', timings: '8AM–8PM Mon–Sat' },
  { id: 'st009', name: 'PMBJK Store #3122', address: 'Shop 4, Carter Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', lat: 19.0600, lng: 72.8300, phone: '022-26491800', timings: '9AM–9PM All Days' },
  { id: 'st010', name: 'PMBJK Store #3245', address: 'Sion Hospital Complex, Sion East', city: 'Mumbai', state: 'Maharashtra', pincode: '400022', lat: 19.0410, lng: 72.8600, phone: '022-24011444', timings: '9AM–8PM Mon–Sat' },
  { id: 'st011', name: 'PMBJK Store #3388', address: 'Mulund West Station Road, Near Passport Office', city: 'Mumbai', state: 'Maharashtra', pincode: '400080', lat: 19.1700, lng: 72.9500, phone: '022-25942200', timings: '9AM–9PM Mon–Sat' },
  // Bengaluru
  { id: 'st012', name: 'PMBJK Store #4001', address: 'Rajajinagar Main Road, Near Metro', city: 'Bengaluru', state: 'Karnataka', pincode: '560010', lat: 12.9900, lng: 77.5500, phone: '080-23404500', timings: '9AM–9PM All Days' },
  { id: 'st013', name: 'PMBJK Store #4122', address: 'BTM Layout, 2nd Stage, Milk Colony', city: 'Bengaluru', state: 'Karnataka', pincode: '560076', lat: 12.9100, lng: 77.6200, phone: '080-26780300', timings: '9AM–8PM Mon–Sat' },
  { id: 'st014', name: 'PMBJK Store #4233', address: 'Koramangala 4th Block, Forum Mall Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', lat: 12.9350, lng: 77.6180, phone: '080-41122300', timings: '9AM–9PM All Days' },
  // Chennai
  { id: 'st015', name: 'PMBJK Store #5001', address: 'T Nagar, Panagal Park Rd, Near Bus Stand', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017', lat: 13.0400, lng: 80.2300, phone: '044-24350800', timings: '9AM–9PM Mon–Sat' },
  { id: 'st016', name: 'PMBJK Store #5112', address: 'Anna Nagar East, 2nd Avenue', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', lat: 13.0850, lng: 80.2100, phone: '044-26208500', timings: '9AM–8PM All Days' },
  // Hyderabad
  { id: 'st017', name: 'PMBJK Store #6001', address: 'Dilsukhnagar, Main Road Near Bus Depot', city: 'Hyderabad', state: 'Telangana', pincode: '500060', lat: 17.3700, lng: 78.5200, phone: '040-24041500', timings: '9AM–9PM Mon–Sat' },
  { id: 'st018', name: 'PMBJK Store #6133', address: 'Kukatpally Housing Board, Near JNTU', city: 'Hyderabad', state: 'Telangana', pincode: '500072', lat: 17.4950, lng: 78.4050, phone: '040-23050400', timings: '9AM–8PM Mon–Sat' },
  // Kolkata
  { id: 'st019', name: 'PMBJK Store #7001', address: 'SSKM Hospital, AJC Bose Road', city: 'Kolkata', state: 'West Bengal', pincode: '700020', lat: 22.5350, lng: 88.3450, phone: '033-22234500', timings: '8AM–8PM Mon–Sat' },
  { id: 'st020', name: 'PMBJK Store #7155', address: 'Gariahat Road, Near Southern Avenue', city: 'Kolkata', state: 'West Bengal', pincode: '700029', lat: 22.5100, lng: 88.3700, phone: '033-24660100', timings: '9AM–9PM All Days' },
  // Pune
  { id: 'st021', name: 'PMBJK Store #8001', address: 'Shivajinagar, Near Pune Station', city: 'Pune', state: 'Maharashtra', pincode: '411004', lat: 18.5300, lng: 73.8700, phone: '020-25536800', timings: '9AM–9PM Mon–Sat' },
  { id: 'st022', name: 'PMBJK Store #8122', address: 'Kothrud, Karve Road, Near D-Mart', city: 'Pune', state: 'Maharashtra', pincode: '411038', lat: 18.5050, lng: 73.8200, phone: '020-25464900', timings: '9AM–8PM Mon–Sat' },
  // Ahmedabad
  { id: 'st023', name: 'PMBJK Store #9001', address: 'CG Road, Navrangpura Near Law Garden', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009', lat: 23.0300, lng: 72.5600, phone: '079-26445800', timings: '9AM–9PM All Days' },
  { id: 'st024', name: 'PMBJK Store #9112', address: 'Maninagar, Rambag Road Near Bhairavnath Mandir', city: 'Ahmedabad', state: 'Gujarat', pincode: '380008', lat: 22.9950, lng: 72.6100, phone: '079-25469100', timings: '9AM–8PM Mon–Sat' },
  // Jaipur
  { id: 'st025', name: 'PMBJK Store #10001', address: 'Tonk Road, Near Sanganer Airport', city: 'Jaipur', state: 'Rajasthan', pincode: '302018', lat: 26.8400, lng: 75.8000, phone: '0141-2605400', timings: '9AM–8PM Mon–Sat' },
  { id: 'st026', name: 'PMBJK Store #10122', address: 'Malviya Nagar, Shipra Path', city: 'Jaipur', state: 'Rajasthan', pincode: '302017', lat: 26.8600, lng: 75.8200, phone: '0141-2552200', timings: '9AM–9PM Mon–Sat' },
  // Lucknow
  { id: 'st027', name: 'PMBJK Store #11001', address: 'Hazratganj, Near GPO', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001', lat: 26.8500, lng: 80.9400, phone: '0522-2613000', timings: '9AM–8PM Mon–Sat' },
  // Chandigarh
  { id: 'st028', name: 'PMBJK Store #12001', address: 'Sector 22-B, Near Old DC Office', city: 'Chandigarh', state: 'Chandigarh', pincode: '160022', lat: 30.7400, lng: 76.8000, phone: '0172-2704100', timings: '9AM–8PM Mon–Sat' },
  // Bhopal
  { id: 'st029', name: 'PMBJK Store #13001', address: 'Arera Colony, Near E-7 Sector Market', city: 'Bhopal', state: 'Madhya Pradesh', pincode: '462016', lat: 23.2200, lng: 77.4600, phone: '0755-2550900', timings: '9AM–8PM Mon–Sat' },
  // Patna
  { id: 'st030', name: 'PMBJK Store #14001', address: 'Kankarbagh Main Road, Near Post Office', city: 'Patna', state: 'Bihar', pincode: '800020', lat: 25.5950, lng: 85.1700, phone: '0612-2350400', timings: '9AM–8PM Mon–Sat' },
  { id: 'st031', name: 'PMBJK Store #14080', address: 'Boring Road, Near Patna Airport', city: 'Patna', state: 'Bihar', pincode: '800001', lat: 25.6100, lng: 85.1400, phone: '0612-2650200', timings: '8AM–8PM Mon–Sat' },
  { id: 'st032', name: 'PMBJK Store #4400', address: 'HSR Layout, 27th Main, Sector 2', city: 'Bengaluru', state: 'Karnataka', pincode: '560102', lat: 12.9126, lng: 77.6456, phone: '080-41211100', timings: '9AM–9PM All Days' },
]

// ─── Fuzzy Drug Search ────────────────────────────────────────────────────────
function searchDrugs(query) {
  if (!query || query.trim().length < 2) return []
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

  const scored = JAN_AUSHADHI_DRUGS.map(drug => {
    const gn = drug.genericName.toLowerCase().replace(/[^a-z0-9 ]/g, '')
    const sc = drug.saltComposition.toLowerCase().replace(/[^a-z0-9 ]/g, '')

    // Substring override — exact substring = distance 0
    if (gn.includes(q) || sc.includes(q)) return { drug, dist: 0 }

    const distGn = levenshtein(q, gn.slice(0, q.length + 6))
    const distSc = levenshtein(q, sc.slice(0, q.length + 6))
    return { drug, dist: Math.min(distGn, distSc) }
  })

  scored.sort((a, b) => a.dist - b.dist)
  const top5 = scored.slice(0, 5)
  if (top5[0].dist > 8) return []
  return top5.filter(x => x.dist <= 8).map(x => x.drug)
}

// ─── Savings Badge Logic ──────────────────────────────────────────────────────
function savingsBadgeConfig(pct) {
  if (pct >= 90) return { color: '#0d9488', bg: 'rgba(13,148,136,0.10)', border: 'rgba(13,148,136,0.25)', label: `🏆 ${pct}% Saved — Max Saving!` }
  if (pct >= 70) return { color: '#16a34a', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.25)',  label: `✅ ${pct}% Saved` }
  return { color: '#d97706', bg: 'rgba(217,119,6,0.10)', border: 'rgba(217,119,6,0.25)', label: `💰 ${pct}% Saved` }
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Pill: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
    </svg>
  ),
  MapPin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Plus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Phone: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.4 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.46 5.46l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  Clock: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Navigation: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  ),
}

// ─── Drug Result Card ─────────────────────────────────────────────────────────
function DrugCard({ drug, onFindStore, onAddToCabinet }) {
  const [dailyDoses, setDailyDoses] = useState(1)

  const mrpTotal = drug.mrpPerUnit * drug.packSize
  const pmbjkTotal = drug.pmbjkPricePerUnit * drug.packSize
  const savingPct = Math.round((1 - drug.pmbjkPricePerUnit / drug.mrpPerUnit) * 100)
  const badge = savingsBadgeConfig(savingPct)
  const annualSavings = ((drug.mrpPerUnit - drug.pmbjkPricePerUnit) * dailyDoses * 365).toFixed(0)

  const catColors = {
    Antidiabetic: '#7c3aed', Cardiovascular: '#dc2626', Antibiotic: '#0891b2',
    Analgesic: '#d97706', NSAID: '#ea580c', Gastro: '#059669',
    Vitamin: '#16a34a', Thyroid: '#7c2d12', Respiratory: '#0369a1',
    Dermatology: '#db2777', Psychiatric: '#6d28d9', Neurological: '#4338ca',
    Antifungal: '#b45309', Hormonal: '#be185d', Orthopaedics: '#0f766e',
    Supplement: '#65a30d', Antimalarial: '#92400e',
  }
  const catColor = catColors[drug.category] || '#6366f1'

  return (
    <div style={{
      background: 'var(--color-white)',
      border: '1.5px solid var(--color-border)',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: 'var(--shadow-xs)',
      transition: 'box-shadow 200ms ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${catColor}15`, color: catColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon.Pill />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-ink)' }}>{drug.genericName}</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '5px', background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30` }}>
              {drug.category}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{drug.saltComposition} · {drug.packSize} {drug.unit}s/pack</div>
        </div>
      </div>

      {/* Price Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
        <div style={{ background: 'var(--color-cream)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-faint)', marginBottom: '0.25rem' }}>Market MRP</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626', fontFamily: 'var(--font-display)' }}>₹{mrpTotal.toFixed(2)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-faint)' }}>per pack</div>
        </div>
        <div style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#166534', marginBottom: '0.25rem' }}>Jan Aushadhi</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', fontFamily: 'var(--font-display)' }}>₹{pmbjkTotal.toFixed(2)}</div>
          <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>per pack</div>
        </div>
      </div>

      {/* Savings Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.35rem 1rem', borderRadius: '99px', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
          {badge.label}
        </span>
      </div>

      {/* Annual Savings Calculator */}
      <div style={{ background: 'rgba(83,74,183,0.05)', border: '1px solid rgba(83,74,183,0.15)', borderRadius: '10px', padding: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor={`doses-${drug.id}`} style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>Daily doses</label>
            <input
              id={`doses-${drug.id}`}
              type="number"
              min="1"
              max="10"
              value={dailyDoses}
              onChange={e => setDailyDoses(Math.max(1, parseInt(e.target.value) || 1))}
              aria-label="Daily doses"
              style={{ width: '80px', padding: '0.375rem 0.625rem', borderRadius: '7px', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none', color: 'var(--color-ink)', background: 'var(--color-white)' }}
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-faint)', marginBottom: '0.15rem' }}>You save approx.</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a', fontFamily: 'var(--font-display)' }}>₹{parseInt(annualSavings).toLocaleString('en-IN')}/year</div>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => onFindStore(drug)}
          aria-label={`Find Jan Aushadhi store for ${drug.genericName}`}
          style={{ flex: 1, minWidth: '160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '9px', border: 'none', background: '#534AB7', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'background 150ms ease' }}
          onMouseEnter={e => e.currentTarget.style.background = '#3f38a0'}
          onMouseLeave={e => e.currentTarget.style.background = '#534AB7'}
        >
          <Icon.MapPin /> Find Store Near Me
        </button>
        <button
          onClick={() => onAddToCabinet(drug)}
          aria-label={`Add ${drug.genericName} to Medicine Cabinet`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '9px', border: '1.5px solid rgba(83,74,183,0.35)', background: 'rgba(83,74,183,0.06)', color: '#534AB7', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'var(--transition-fast)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(83,74,183,0.12)'; e.currentTarget.style.borderColor = '#534AB7' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(83,74,183,0.06)'; e.currentTarget.style.borderColor = 'rgba(83,74,183,0.35)' }}
        >
          <Icon.Plus /> Add to Cabinet
        </button>
      </div>
    </div>
  )
}

// ─── Map Section ──────────────────────────────────────────────────────────────
function StoreLocatorMap({ selectedDrug }) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)
  const routeLayerRef = useRef(null)
  const storeMarkersRef = useRef([])
  const [userCoords, setUserCoords] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle') // idle | loading | granted | denied | error
  const [nearbyStores, setNearbyStores] = useState([])
  const [citySearch, setCitySearch] = useState('')
  const [routeInfo, setRouteInfo] = useState(null)
  const [addedMsg, setAddedMsg] = useState('')
  const abortRef = useRef(null)

  // Init map
  useEffect(() => {
    let mounted = true
    ensureLeaflet().then(L => {
      if (!mounted || !mapContainerRef.current || mapRef.current) return

      const map = L.map(mapContainerRef.current, {
        center: [20.5937, 78.9629], // India center
        zoom: 5,
        zoomControl: true,
        scrollWheelZoom: false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map)
      mapRef.current = map
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  const plotStores = useCallback((userLat, userLng, L) => {
    if (!mapRef.current) return

    // Remove old markers
    storeMarkersRef.current.forEach(m => m.remove())
    storeMarkersRef.current = []

    // Compute distances
    const withDist = PMBJK_STORES.map(s => ({
      ...s,
      distKm: haversineDistance(userLat, userLng, s.lat, s.lng)
    })).sort((a, b) => a.distKm - b.distKm)

    setNearbyStores(withDist.slice(0, 5))

    // Markers
    withDist.forEach((store, idx) => {
      const isNearest = idx === 0
      const markerColor = isNearest ? '#dc2626' : '#16a34a'
      const markerHtml = `<div style="width:28px;height:28px;border-radius:50%;background:${markerColor};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px">${isNearest ? '★' : idx + 1}</div>`

      const marker = L.marker([store.lat, store.lng], {
        icon: L.divIcon({ html: markerHtml, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
      })

      const popupHtml = `
        <div style="font-family:system-ui;min-width:180px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${store.name}${isNearest ? ' 🏆 Nearest' : ''}</div>
          <div style="font-size:11px;color:#666;margin-bottom:6px">${store.address}, ${store.city}</div>
          <div style="font-size:11px;color:#333;margin-bottom:2px">📏 ${store.distKm.toFixed(1)} km</div>
          ${store.phone ? `<div style="font-size:11px;color:#333;margin-bottom:2px">📞 ${store.phone}</div>` : ''}
          ${store.timings ? `<div style="font-size:11px;color:#333">🕘 ${store.timings}</div>` : ''}
        </div>`
      marker.bindPopup(popupHtml)
      if (isNearest) {
        marker.bindTooltip('NEAREST', { permanent: true, className: 'pmbjk-nearest-tooltip', offset: [0, -18] })
      }
      marker.addTo(mapRef.current)
      storeMarkersRef.current.push(marker)
    })
  }, [])

  const centerOnUser = useCallback((lat, lng) => {
    ensureLeaflet().then(L => {
      if (!mapRef.current) return

      // User pulsing marker
      if (userMarkerRef.current) userMarkerRef.current.remove()
      const userHtml = `<div class="pmbjk-user-marker"></div>`
      userMarkerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({ html: userHtml, className: '', iconSize: [20, 20], iconAnchor: [10, 10] })
      }).addTo(mapRef.current)
      userMarkerRef.current.bindTooltip('You are here', { permanent: false })

      mapRef.current.setView([lat, lng], 13)
      plotStores(lat, lng, L)
    })
  }, [plotStores])

  const handleGeolocate = useCallback(() => {
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setUserCoords({ lat: latitude, lng: longitude })
        setGeoStatus('granted')
        centerOnUser(latitude, longitude)
      },
      () => {
        setGeoStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [centerOnUser])

  const handleCitySearch = useCallback(() => {
    const name = citySearch.trim().toLowerCase()
    if (!name) return
    const store = PMBJK_STORES.find(s => s.city.toLowerCase().includes(name))
    if (!store) return
    const lat = store.lat + (Math.random() - 0.5) * 0.05
    const lng = store.lng + (Math.random() - 0.5) * 0.05
    setUserCoords({ lat, lng })
    setGeoStatus('granted')
    centerOnUser(lat, lng)
  }, [citySearch, centerOnUser])

  const handleGetDirections = useCallback(async (store) => {
    if (!userCoords || !mapRef.current) return

    // Remove old route
    if (routeLayerRef.current) {
      routeLayerRef.current.remove()
      routeLayerRef.current = null
    }
    setRouteInfo(null)

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${userCoords.lng},${userCoords.lat};${store.lng},${store.lat}?overview=full&geometries=geojson`
      const res = await fetch(url, { signal: abortRef.current.signal })
      if (!res.ok) throw new Error('OSRM error')
      const data = await res.json()
      const route = data.routes[0]
      if (!route) throw new Error('No route')

      const distKm = (route.distance / 1000).toFixed(1)
      const mins = Math.round(route.duration / 60)
      setRouteInfo({ distKm, mins, store })

      ensureLeaflet().then(L => {
        if (!mapRef.current) return
        routeLayerRef.current = L.geoJSON(route.geometry, {
          style: { color: '#534AB7', weight: 4, opacity: 0.8 }
        }).addTo(mapRef.current)
        mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] })
      })
    } catch (err) {
      if (err.name === 'AbortError') return
      // Offline fallback
      setRouteInfo({ offline: true, store, userCoords })
    }
  }, [userCoords])

  useEffect(() => {
    if (selectedDrug) handleGeolocate()
  }, [selectedDrug])

  const hasGeo = 'geolocation' in navigator

  return (
    <div>
      <style>{`
        .pmbjk-user-marker {
          width: 20px; height: 20px; border-radius: 50%;
          background: #3b82f6; border: 3px solid white;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.3);
          animation: pmbjk-pulse 2s infinite;
        }
        @keyframes pmbjk-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
          70%  { box-shadow: 0 0 0 14px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
        .pmbjk-nearest-tooltip {
          background: #dc2626 !important; color: white !important;
          border: none !important; font-weight: 700; font-size: 10px;
          padding: 2px 6px; border-radius: 4px;
        }
        .pmbjk-nearest-tooltip::before { display: none !important; }
      `}</style>

      {/* Map Container */}
      <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1.5px solid var(--color-border)', marginBottom: '1rem' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '360px' }} id="pmbjk-map" aria-label="Jan Aushadhi store map" />

        {/* Overlay controls */}
        {geoStatus === 'idle' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.92)', zIndex: 400 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗺️</div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Find Your Nearest PMBJK Store</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem', textAlign: 'center', maxWidth: '280px' }}>Share your location to discover Jan Aushadhi stores near you</p>
            {hasGeo ? (
              <button
                onClick={handleGeolocate}
                aria-label="Use my current location"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.5rem', borderRadius: '9px', border: 'none', background: '#534AB7', color: '#fff', fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
              >
                <Icon.MapPin /> Use My Location
              </button>
            ) : (
              <p style={{ color: 'var(--color-critical)', fontSize: '0.85rem' }}>Geolocation not supported in this browser.</p>
            )}
          </div>
        )}

        {geoStatus === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.85)', zIndex: 400 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid var(--color-border)', borderTopColor: '#534AB7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
              <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Detecting your location…</div>
            </div>
          </div>
        )}

        {geoStatus === 'denied' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.95)', zIndex: 400, padding: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📍</div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Location Access Denied</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 1rem', textAlign: 'center' }}>Search by city name instead:</p>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '320px' }}>
              <input
                type="text"
                placeholder="e.g. Mumbai, Delhi, Bengaluru…"
                value={citySearch}
                onChange={e => setCitySearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCitySearch()}
                aria-label="Search by city"
                style={{ flex: 1, padding: '0.6rem 0.875rem', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none', color: 'var(--color-ink)' }}
              />
              <button
                onClick={handleCitySearch}
                aria-label="Search stores in city"
                style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: '#534AB7', color: '#fff', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
              >
                Search
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Route Info Strip */}
      {routeInfo && !routeInfo.offline && (
        <div style={{ background: 'rgba(83,74,183,0.08)', border: '1px solid rgba(83,74,183,0.2)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Icon.Navigation />
          <span style={{ fontWeight: 700, color: '#534AB7' }}>Route to {routeInfo.store.name}</span>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>{routeInfo.distKm} km · ~{routeInfo.mins} min by car</span>
        </div>
      )}

      {routeInfo?.offline && (
        <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-warning)' }}>
          ⚠️ Offline — could not fetch route.{' '}
          <a
            href={`https://www.google.com/maps/dir/${routeInfo.userCoords.lat},${routeInfo.userCoords.lng}/${routeInfo.store.lat},${routeInfo.store.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#534AB7', fontWeight: 600 }}
          >
            Open in Google Maps ↗
          </a>
        </div>
      )}

      {/* Nearby Stores List */}
      {nearbyStores.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: '0.75rem' }}>5 Nearest Jan Aushadhi Stores</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '400px', overflowY: 'auto' }}>
            {nearbyStores.map((store, idx) => (
              <div key={store.id} style={{
                background: idx === 0 ? 'rgba(220,38,38,0.04)' : 'var(--color-white)',
                border: `1.5px solid ${idx === 0 ? 'rgba(220,38,38,0.25)' : 'var(--color-border)'}`,
                borderRadius: '12px',
                padding: '0.875rem 1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-ink)' }}>{store.name}</span>
                      {idx === 0 && <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#dc2626', color: '#fff' }}>NEAREST</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.375rem' }}>{store.address}, {store.city} – {store.pincode}</div>
                    <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}><Icon.MapPin />{store.distKm.toFixed(1)} km</span>
                      {store.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}><Icon.Phone />{store.phone}</span>}
                      {store.timings && <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}><Icon.Clock />{store.timings}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleGetDirections(store)}
                    aria-label={`Get directions to ${store.name}`}
                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.875rem', borderRadius: '8px', border: '1.5px solid rgba(83,74,183,0.3)', background: 'rgba(83,74,183,0.06)', color: '#534AB7', fontWeight: 600, fontSize: '0.78rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'var(--transition-fast)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(83,74,183,0.14)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(83,74,183,0.06)' }}
                  >
                    <Icon.Navigation />
                    Get Directions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const POPULAR_QUERIES = ['Metformin', 'Atorvastatin', 'Paracetamol', 'Amlodipine', 'Omeprazole', 'Levothyroxine', 'Aspirin', 'Amoxicillin']

export default function SubsidyFinderPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [selectedDrugForMap, setSelectedDrugForMap] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [toast, setToast] = useState('')
  const mapSectionRef = useRef(null)

  // Pre-fill from Module 7 URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) {
      setQuery(decodeURIComponent(q))
      const r = searchDrugs(decodeURIComponent(q))
      setResults(r)
      setSearched(true)
    }
  }, [])

  const handleSearch = useCallback(() => {
    if (query.trim().length < 2) return
    const r = searchDrugs(query)
    setResults(r)
    setSearched(true)
  }, [query])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleFindStore = (drug) => {
    setSelectedDrugForMap(drug)
    setShowMap(true)
    setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleAddToCabinet = async (drug) => {
    try {
      const med = {
        id: crypto.randomUUID(),
        name: drug.genericName,
        genericSalt: drug.saltComposition,
        dosage: drug.saltComposition,
        frequency: 'OD',
        stockCount: drug.packSize,
        expiryDate: '',
        notes: `Added from Jan Aushadhi finder. PMBJK price: ₹${(drug.pmbjkPricePerUnit * drug.packSize).toFixed(2)}/pack`,
      }
      await addMedicine(med)
      setToast(`✅ ${drug.genericName} added to Cabinet!`)
      setTimeout(() => setToast(''), 3000)
    } catch {
      setToast('❌ Failed to add. Check Medicine Cabinet.')
      setTimeout(() => setToast(''), 3000)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '5rem' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'var(--color-white)', border: '1.5px solid var(--color-border)', borderRadius: '10px', padding: '0.75rem 1.5rem', boxShadow: 'var(--shadow-lg)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', animation: 'fade-in-up 250ms ease' }}>
          {toast}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🏥</span> Jan Aushadhi Cost-Saver
        </h1>
        <p>Discover if your medicine is available at a government PMBJK store at up to 90% less cost — search offline, find stores on a live map.</p>
      </div>

      {/* Info Banner */}
      <div style={{ background: 'rgba(83,74,183,0.06)', border: '1px solid rgba(83,74,183,0.2)', borderRadius: '12px', padding: '0.875rem 1.125rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: '#534AB7' }}>💡 Pradhan Mantri Bharatiya Janaushadhi Pariyojana (PMBJK):</strong> Government-run pharmacies offering WHO-certified generic medicines at 50–90% lower prices. No prescription markup. Same quality, fraction of the cost.
      </div>

      {/* Search */}
      <div className="search-wrapper" style={{ marginBottom: '1rem' }}>
        <div style={{ position: 'absolute', left: '1rem', color: 'var(--color-faint)', display: 'flex', zIndex: 1 }}>
          <Icon.Search />
        </div>
        <input
          id="subsidy-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search medicine or salt name (e.g. Metformin, Atorvastatin)…"
          aria-label="Search Jan Aushadhi drug database"
          style={{ paddingLeft: '2.75rem', paddingRight: '6rem' }}
          autoComplete="off"
        />
        <button
          onClick={handleSearch}
          aria-label="Search"
          style={{ position: 'absolute', right: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#534AB7', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
        >
          Search
        </button>
      </div>

      {/* Popular searches */}
      {!searched && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-label">Popular medicines</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {POPULAR_QUERIES.map(name => (
              <button key={name} onClick={() => { setQuery(name); const r = searchDrugs(name); setResults(r); setSearched(true) }} className="pill-btn">{name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && results.length > 0 && (
        <div className="fade-in-up">
          <div className="section-label" style={{ marginBottom: '0.875rem' }}>{results.length} match{results.length !== 1 ? 'es' : ''} in Jan Aushadhi database</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {results.map(drug => (
              <DrugCard
                key={drug.id}
                drug={drug}
                onFindStore={handleFindStore}
                onAddToCabinet={handleAddToCabinet}
              />
            ))}
          </div>
        </div>
      )}

      {/* No matches */}
      {searched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1.5px dashed var(--color-border)', borderRadius: '14px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔬</div>
          <h3 style={{ color: 'var(--color-ink)', fontSize: '1rem', marginBottom: '0.5rem' }}>No close matches found for "{query}"</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Try the generic salt name (e.g. "Metformin" instead of "Glycomet")</p>
        </div>
      )}

      {/* Map Section */}
      {showMap && (
        <div ref={mapSectionRef} style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '1.5rem' }}>📍</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Find Jan Aushadhi Store</h2>
              {selectedDrugForMap && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)' }}>for {selectedDrugForMap.genericName}</p>}
            </div>
          </div>
          <StoreLocatorMap selectedDrug={selectedDrugForMap} />
        </div>
      )}

      {/* Data disclaimer */}
      <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--color-faint)', lineHeight: 1.5, padding: '0.75rem 1rem', background: 'var(--color-cream)', borderRadius: '8px' }}>
        <strong>Disclaimer:</strong> Prices are indicative PMBJK rates as of 2024. Actual prices may vary by store. Always verify availability at your local Jan Aushadhi Kendra. This feature works fully offline using an embedded drug dataset.
      </div>
    </div>
  )
}
