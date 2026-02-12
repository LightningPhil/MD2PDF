# Fast Trigger Pulses, Action Integral, and Gate Bond-Wire Stress

This compact document exercises common Markdown features while explaining how **fast gate/trigger pulses** can stress *internal gate bond wires* in semiconductor switches. It aims to render cleanly both on **canvas** and in **PDF**.

---

## 1) Why “action integral” matters

A fast trigger pulse is often judged not only by its peak current, but by its **delivered charge** (the “action” of the pulse in the gate path):

* **Gate charge (action integral):** $Q_g=\int I_g(t),dt$
* **Gate energy:** $E_g=\int V_g(t),I_g(t),dt$

In practice, a very short, very high current spike can deliver the *same* $Q_g$ as a slower pulse, but with **much higher** instantaneous stress on internal conductors due to inductive effects and ringing.

> **Rule of thumb:** you can meet $Q_g$ while still damaging things if you ignore **$dI/dt$**, parasitic inductance, and resonance.

---

## 2) What actually stresses the internal gate bond wires

Key mechanisms that can create bond-wire heating or mechanical fatigue:

1. **Resistive heating** in the gate path (including internal bond wires) scales with $\int I_g^2(t),dt$.
2. **Inductive voltage** across unavoidable inductance: $V_L=L,\dfrac{dI_g}{dt}$, which can force unexpectedly high voltages and ring currents.
3. **Ringing energy** in an $L$–$C$ loop can create repeated current reversals, increasing $\int I_g^2,dt$ even if $Q_g$ is modest.

### 2.1 A minimal lumped model

A common first-pass model for the gate loop is a driven series $R$–$L$ with an effective capacitance:

* Series: $R_g$ (internal + external), $L_g$ (package + layout)
* Shunt/drive: effective $C$ (driver output + device input + stray)

A simplified forced response can be reasoned about via:

$$
V_{\text{drive}}(t)=R_g,I_g(t)+L_g,\frac{dI_g(t)}{dt}+V_C(t)
$$

---

## 3) What to measure or compute

Use both “action” metrics (charge/energy) **and** stress metrics:

* **Charge delivered:** $Q_g=\int I_g,dt$
* **Energy delivered:** $E_g=\int V_g I_g,dt$
* **Thermal stress proxy:** $A_2=\int I_g^2,dt$
* **Peak current and slew:** $I_{g,\text{pk}}$, and $\left(\dfrac{dI_g}{dt}\right)_{\text{pk}}$

### 3.1 Quick checklist

* Use a tight loop measurement for $I_g(t)$ (e.g., current transformer or shunt with good bandwidth).
* Confirm probe bandwidth and avoid ground-lead inductance artifacts.
* Capture enough time window to include ringing tails.

---

## 4) Compact table of variables and “what to look for”

| Quantity             |                Symbol | Units | Meaning                | Notes                    |
| -------------------- | --------------------: | ----: | ---------------------- | ------------------------ |
| Gate charge          |                 $Q_g$ |     C | Total delivered charge | $Q_g=\int I_g,dt$        |
| Gate energy          |                 $E_g$ |     J | Delivered energy       | $E_g=\int V_g I_g,dt$    |
| I-squared action     |                 $A_2$ |  A²·s | Heating proxy          | $A_2=\int I_g^2,dt$      |
| Peak gate current    |     $I_{g,\text{pk}}$ |     A | Max current            | Bond-wire stress risk    |
| Peak slew rate       | $(dI/dt)_{\text{pk}}$ |   A/s | Fast edges             | Drives $V_L=L,dI/dt$     |
| Gate loop inductance |                 $L_g$ |     H | Parasitic inductance   | Layout/package dominated |
| Gate resistance      |                 $R_g$ |     Ω | Damping & limit        | Add series $R$ near pin  |

---

## 5) Full-width table test

This table is intentionally wider (more columns) to test page scaling, column alignment, and cell wrapping in both canvas and PDF.

| Case | Pulse description                        | $Q_g=\int I_g,dt$ (same?) | $I_{g,\text{pk}}$ | $(dI/dt)_{\text{pk}}$ | Ringing duration | $A_2=\int I_g^2,dt$ (relative) | Expected bond-wire stress | Notes / diagnosis hint                                                 |
| ---- | ---------------------------------------- | ------------------------- | ----------------: | --------------------: | ---------------: | ------------------------------ | ------------------------- | ---------------------------------------------------------------------- |
| A    | Very fast spike, minimal damping         | Yes                       |              High |             Very high |           Medium | High                           | High                      | Often “works” electrically but can be brutal mechanically/thermally    |
| B    | Slower pulse, well-damped                | Yes                       |            Medium |                Medium |              Low | Medium                         | Medium                    | Usually safest if turn-on delay still meets requirement                |
| C    | Fast edge + strong ringing               | Yes (net)                 |              High |                  High |             Long | Very high                      | Very high                 | Ringing can dominate $A_2$ even if $Q_g$ looks fine                    |
| D    | Charge-limited boost (capacitor + clamp) | Bounded                   |       Medium–High |           Medium–High |       Low–Medium | Medium                         | Medium                    | Good compromise: strong initial drive but bounded energy/charge        |
| E    | Under-driven (insufficient $Q_g$)        | No                        |               Low |                   Low |              Low | Low                            | Low                       | Low stress, but risks delayed turn-on and higher main-path dissipation |

---

## 6) Example: comparing “equal charge” pulses

Two pulses can have the same $Q_g$ but different stress:

* Pulse A: high peak, short duration
* Pulse B: lower peak, longer duration

If both deliver the same charge,
$Q_g=\int I_g,dt$ is equal, but typically

* Pulse A has higher $I_{g,\text{pk}}$
* Pulse A has higher $(dI/dt)_{\text{pk}}$
* Pulse A can have higher $A_2=\int I_g^2,dt$ (more heating)

A simple illustration using idealized rectangular pulses:

$$
Q_g = I,\Delta t
\qquad\text{and}\qquad
A_2 = I^2,\Delta t
$$

So if you double $I$ and halve $\Delta t$, $Q_g$ stays the same, but $A_2$ doubles.

---

## 7) Practical mitigation ideas

* Add a **small series resistor** near the device gate pin to damp ringing.
* Use **clamps** to limit overshoot and reverse drive (e.g., diode networks or TVS as appropriate).
* Minimize loop inductance: short traces, tight return, coax/stripline where practical.
* Prefer **charge-limited** boosting: design so the maximum deliverable $Q_g$ is bounded.

> **Caution:** “Harder” drive is not always better. You want *fast enough*, but with controlled ringing and bounded stress.

---

## 8) Lists test

### 8.1 Numbered list (procedure)

1. Record $I_g(t)$ and $V_g(t)$ during a trigger event.
2. Compute $Q_g=\int I_g,dt$ and $A_2=\int I_g^2,dt$.
3. Check $I_{g,\text{pk}}$ and ringing duration.
4. Modify $R_g$ / layout to reduce ringing; re-measure.

### 8.2 Bulleted list (failure signs)

* Inconsistent turn-on delay despite similar $Q_g$
* Gate waveform shows high-frequency ringing
* Device heating increases when “faster” gate drive is used
* Occasional gate overvoltage events

---

## 9) Blockquote test

> **Interpretation tip:** If $Q_g$ is adequate but turn-on is erratic, the issue may be **pulse shape**, **transformer coupling**, or **parasitics**, not simply “more charge.”

---

## 10) Code block test (numerical integration)

```python
# Sampled waveforms: time_s, Ig_A, Vg_V are equal-length arrays.
# Compute gate charge Qg, energy Eg, and I^2 action A2 via trapezoidal integration.

def trapz(y, t):
    return sum(0.5 * (y[i] + y[i-1]) * (t[i] - t[i-1]) for i in range(1, len(t)))

Qg_C  = trapz(Ig_A, time_s)
Eg_J  = trapz([Vg_V[i] * Ig_A[i] for i in range(len(time_s))], time_s)
A2_As = trapz([Ig_A[i] * Ig_A[i] for i in range(len(time_s))], time_s)

print("Qg (C):", Qg_C)
print("Eg (J):", Eg_J)
print("A2 (A^2*s):", A2_As)
```

---

## 11) Inline and display math recap

Inline examples: $V_L=L,dI/dt$, $Q_g=\int I_g,dt$, and $A_2=\int I_g^2,dt$.

Display example:

$$
\text{Bond-wire heating risk} ;\propto; \int I_g^2(t),dt
\qquad\text{while}\qquad
\text{Turn-on “dose”} ;\approx; \int I_g(t),dt
$$
