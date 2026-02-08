# 📄 Markdown Feature Showcase

This file demonstrates **most commonly used Markdown features**, plus
inline and block **LaTeX equations** suitable for KaTeX / MathJax
renderers. It is READ ONLY - don't try and update it!!

---

## ✨ Mathematics (Near the Top)

### Inline Math

Einstein's mass–energy relation is written inline as this $E = mc^2$ which should flow nicely in the text.

The quadratic formula inline:

$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$

---

### Display / Block Math

Centered equation blocks:

$$
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
$$

$$
\int_{0}^{\infty} e^{-x^2} \, dx = \frac{\sqrt{\pi}}{2}
$$

Matrix example:

$$
A =
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$

Aligned equations:

$$
\begin{aligned}
f(x) &= x^2 + 2x + 1 \\
     &= (x+1)^2
\end{aligned}
$$

Cases:

$$
f(x) =
\begin{cases}
x^2, & x \ge 0 \\
-x, & x < 0
\end{cases}
$$

---

## 🧱 Headings

# Heading Level 1

## Heading Level 2

### Heading Level 3

#### Heading Level 4

##### Heading Level 5

###### Heading Level 6

---

## ✍️ Emphasis

- *Italic*
- **Bold**
- ***Bold + Italic***
- ~~Strikethrough~~

---

## 📋 Lists

### Unordered

- Apples
- Oranges
  - Mandarins
  - Clementines
- Pears

### Ordered

1. First item
2. Second item
3. Third item

### Task Lists

- [x] Write Markdown example
- [x] Add LaTeX math
- [ ] Export to PDF

---

## 🔗 Links

[Markdown Guide](https://www.markdownguide.org)

[CommonMark](https://commonmark.org)

---

## 🖼️ Images

```markdown
![Alt text](https://example.com/image.png)
```

---

## 💬 Blockquotes

> This is a blockquote.
>
> > Nested blockquotes also work.

---

## 💻 Code

Inline: `printf("hello");`

```python
import math
print(math.pi)
```

---

## 📊 Tables

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |

Math inside tables:

| Variable | Meaning | Formula |
|---------|---------|---------|
| Energy | Relativistic energy | $E = mc^2$ |
| Area | Circle area | $A = \pi r^2$ |

---

## 📎 Horizontal Rules

---

---

---

---

## 🧬 Footnotes

Footnote here.[^1]

---

## 🧩 HTML

<div>
<strong>HTML inside Markdown</strong>
</div>

---

## 📐 End

Everything above is valid Markdown with KaTeX-compatible LaTeX math.

[^1]: Footnote text.
