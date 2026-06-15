import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import * as api from '../services/api.js'

vi.mock('../services/api.js', () => ({
  assessSymptoms: vi.fn()
}))

import TriagePage from '../pages/TriagePage.jsx'

describe('TriagePage Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows filling out the symptom form and displaying triage results (critical)', async () => {
    vi.mocked(api.assessSymptoms).mockResolvedValueOnce({
      urgency_level: "critical",
      urgency_label: "Seek Emergency Care Immediately",
      urgency_color: "critical",
      recommendation: "Please go to the nearest emergency room.",
      conditions: [
        { name: "Migraine", probability: 0.75, urgency: "moderate" }
      ],
      risk_factors: [],
      is_mock: false,
      mock_notice: ""
    })

    render(
      <MemoryRouter>
        <TriagePage />
      </MemoryRouter>
    )

    // Verify header title is rendered
    expect(screen.getByText(/Symptom Triage Analyzer/i)).toBeInTheDocument()

    // Find input and type symptom
    const symptomInput = screen.getByLabelText(/Describe your symptoms/i)
    fireEvent.change(symptomInput, { target: { value: 'Chest pain radiating to arm' } })

    // Find age input and change
    const ageInput = screen.getByLabelText(/Age/i)
    fireEvent.change(ageInput, { target: { value: 45 } })

    // Click assess button
    const submitBtn = screen.getByRole('button', { name: /Assess My Symptoms/i })
    fireEvent.click(submitBtn)

    // Verify results are displayed
    await waitFor(() => {
      expect(screen.getByText(/Seek Emergency Care Immediately/i)).toBeInTheDocument()
      expect(screen.getByText(/Please go to the nearest emergency room/i)).toBeInTheDocument()
      expect(screen.getByText(/Migraine/i)).toBeInTheDocument()
    })

    // Click reset button
    const resetBtn = screen.getByRole('button', { name: /Assess New Symptoms/i })
    fireEvent.click(resetBtn)

    // Verify back to form
    expect(screen.getByLabelText(/Describe your symptoms/i)).toBeInTheDocument()
  })

  it('handles safe self-care recommendations', async () => {
    vi.mocked(api.assessSymptoms).mockResolvedValueOnce({
      urgency_level: "safe",
      urgency_label: "Self-Care Recommended",
      urgency_color: "safe",
      recommendation: "Rest and stay hydrated.",
      conditions: [
        { name: "Common Cold", probability: 0.90, urgency: "low" }
      ],
      risk_factors: [],
      is_mock: true,
      mock_notice: "Demo notice"
    })

    render(
      <MemoryRouter>
        <TriagePage />
      </MemoryRouter>
    )

    const symptomInput = screen.getByLabelText(/Describe your symptoms/i)
    fireEvent.change(symptomInput, { target: { value: 'Mild runny nose and cough' } })

    const submitBtn = screen.getByRole('button', { name: /Assess My Symptoms/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Self-Care Recommended/i)).toBeInTheDocument()
      expect(screen.getByText(/Rest and stay hydrated/i)).toBeInTheDocument()
      expect(screen.getByText(/Demo notice/i)).toBeInTheDocument()
    })
  })

  it('renders error boundary alert states', async () => {
    vi.mocked(api.assessSymptoms).mockRejectedValueOnce(new Error("Network connection error"))

    render(
      <MemoryRouter>
        <TriagePage />
      </MemoryRouter>
    )

    const symptomInput = screen.getByLabelText(/Describe your symptoms/i)
    fireEvent.change(symptomInput, { target: { value: 'Severe back pain' } })

    const submitBtn = screen.getByRole('button', { name: /Assess My Symptoms/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Network connection error/i)).toBeInTheDocument()
    })
  })

  it('supports selecting a quick example symptom card', () => {
    render(
      <MemoryRouter>
        <TriagePage />
      </MemoryRouter>
    )

    // Click the second example symptom button
    const exampleBtn = screen.getByRole('button', { name: /"Chest pain radiating to my left arm/i })
    fireEvent.click(exampleBtn)

    const symptomInput = screen.getByLabelText(/Describe your symptoms/i)
    expect(symptomInput.value).toContain('Chest pain radiating to my left arm')
  })

  it('handles moderate urgency triage recommendations', async () => {
    vi.mocked(api.assessSymptoms).mockResolvedValueOnce({
      urgency_level: "moderate",
      urgency_label: "Consult Doctor",
      urgency_color: "moderate",
      recommendation: "Please schedule an appointment with your GP.",
      conditions: [],
      risk_factors: [],
      is_mock: false,
      mock_notice: ""
    })

    render(
      <MemoryRouter>
        <TriagePage />
      </MemoryRouter>
    )

    const symptomInput = screen.getByLabelText(/Describe your symptoms/i)
    fireEvent.change(symptomInput, { target: { value: 'Persistent cough for 3 weeks' } })

    const submitBtn = screen.getByRole('button', { name: /Assess My Symptoms/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Consult Doctor/i)).toBeInTheDocument()
      expect(screen.getByText(/Please schedule an appointment with your GP/i)).toBeInTheDocument()
    })
  })

  it('prevents submission when symptoms input length is less than 5 characters', () => {
    render(
      <MemoryRouter>
        <TriagePage />
      </MemoryRouter>
    )

    const symptomInput = screen.getByLabelText(/Describe your symptoms/i)
    fireEvent.change(symptomInput, { target: { value: 'Cold' } }) // 4 characters

    const submitBtn = screen.getByRole('button', { name: /Assess My Symptoms/i })
    expect(submitBtn).toBeDisabled()

    // Try to trigger click anyway (should not execute or change phase)
    fireEvent.click(submitBtn)
    expect(screen.queryByText(/Analysing your symptoms/i)).not.toBeInTheDocument()
  })

  it('triggers hover and focus events on example symptom buttons', () => {
    render(
      <MemoryRouter>
        <TriagePage />
      </MemoryRouter>
    )

    const exampleBtn = screen.getByRole('button', { name: /Mild cough, runny nose/i })

    // Hover, focus, and blur actions to trigger handlers
    fireEvent.focus(exampleBtn)
    fireEvent.mouseEnter(exampleBtn)
    fireEvent.mouseLeave(exampleBtn)
    fireEvent.blur(exampleBtn)

    // Trigger hover style revert when not focused
    fireEvent.mouseLeave(exampleBtn)

    expect(exampleBtn).toBeInTheDocument()
  })

  it('triggers focus and blur styles on form inputs', () => {
    render(
      <MemoryRouter>
        <TriagePage />
      </MemoryRouter>
    )

    const ageInput = screen.getByLabelText(/Age/i)
    fireEvent.focus(ageInput)
    fireEvent.blur(ageInput)

    const sexSelect = screen.getByLabelText(/Biological sex/i)
    fireEvent.focus(sexSelect)
    fireEvent.blur(sexSelect)

    const symptomsTextarea = screen.getByLabelText(/Describe your symptoms/i)
    fireEvent.focus(symptomsTextarea)
    fireEvent.blur(symptomsTextarea)
  })
})
