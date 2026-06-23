/**
 * Prahari — Directory Service (Frontend)
 * ========================================
 * Thin wrappers for the NMC verification endpoint.
 * ABDM and OSM calls all go through the FastAPI backend via api.js.
 */

import { apiFetch } from './api.js'

/**
 * Verify a doctor by name on the NMC Indian Medical Register.
 *
 * @param {string} doctorName - Full or partial doctor name
 * @returns {Promise<{ found: boolean, status: object, nmc_record: object|null }>}
 */
export const verifyDoctorOnNMC = (doctorName) =>
  apiFetch(`/directory/nmc-verify?name=${encodeURIComponent(doctorName)}`)

/**
 * Verify a doctor by NMC registration number.
 *
 * @param {string} regNo - NMC registration number (e.g. "MH-12345")
 * @returns {Promise<{ found: boolean, status: object, nmc_record: object|null }>}
 */
export const verifyDoctorByRegNo = (regNo) =>
  apiFetch(`/directory/nmc-verify?reg_no=${encodeURIComponent(regNo)}`)
