"use client";

import React from "react";
import { loginJourney } from "../journey";

export const Setup2fa = () => {
  const { machine, snapshot } = loginJourney.useLinearJourney();
  const context = snapshot.context;

  return (
    <div className="step">
      <h3>Setup Two-Factor Authentication</h3>
      <p>Scan the QR code below with your authenticator app.</p>
      {context.qrCode ? (
        <div
          style={{
            padding: "1rem",
            background: "#1a1a1a",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            color: "#4ade80",
            marginBottom: "0.75rem",
            wordBreak: "break-all"
          }}
        >
          {context.qrCode}
        </div>
      ) : (
        <div className="loading">Loading QR code...</div>
      )}
      <div className="actions">
        <button className="secondary" onClick={() => void machine.navigate.goToPreviousStep()}>
          Back
        </button>
        <button onClick={() => void machine.navigate.goToNextStep()}>I&apos;ve scanned it</button>
      </div>
    </div>
  );
};
