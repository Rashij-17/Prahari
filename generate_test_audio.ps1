# ============================================================
# Prahari — Test Audio Generator (Native Windows PowerShell)
# ============================================================
# Generates a spoken WAV file containing a clinical transcript.
# Run this script, then upload 'clinical_consultation.wav' to the portal.

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

$outputFile = Join-Path $PSScriptRoot "clinical_consultation.wav"
$synth.SetOutputToWaveFile($outputFile)

$scriptText = "Hello Mr. Sharma, I looked at your reports. Your blood pressure is slightly high. " +
              "I am prescribing you Metformin 500mg to be taken twice daily after meals for the next 30 days. " +
              "Also, please start Crocin 650mg once daily if you experience any mild fevers, but do not exceed it. " +
              "You should also take Pantocid 40mg in the morning on an empty stomach. " +
              "Please avoid eating high-sugar foods or drinking alcohol. " +
              "Let's schedule a follow-up appointment next month on 2026-07-15 at 10:00 AM for a blood check."

Write-Host "Generating spoken audio file: $outputFile..." -ForegroundColor Green
$synth.Speak($scriptText)
$synth.Dispose()

Write-Host "Done! You can now upload 'clinical_consultation.wav' to the portal." -ForegroundColor Green
