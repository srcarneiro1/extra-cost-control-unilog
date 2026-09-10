type TooltipState = {
  tooltip: HTMLDivElement
  line: SVGLineElement | null
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const states = new WeakMap<Element, TooltipState>()

function tooltipContainer(root: Element) {
  if (root.classList.contains('dashboard-projection-chart')) {
    return root.closest('.dashboard-chart-wrap') as HTMLElement | null
  }
  return root.closest('.analytics-viz-card') as HTMLElement | null
}

function ensureState(root: Element, withLine = false): TooltipState | null {
  const existing = states.get(root)
  if (existing) return existing

  const wrap = tooltipContainer(root)
  if (!wrap) return null

  const tooltip = document.createElement('div')
  tooltip.className = 'dashboard-chart-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.hidden = true
  wrap.appendChild(tooltip)

  let line: SVGLineElement | null = null
  if (withLine && root instanceof SVGSVGElement) {
    line = document.createElementNS(SVG_NS, 'line')
    line.classList.add('dashboard-chart-hover-line')
    line.setAttribute('y1', '38')
    line.setAttribute('y2', '262')
    line.style.display = 'none'
    root.appendChild(line)
  }

  const state = { tooltip, line }
  states.set(root, state)
  return state
}

function directSvgTitle(target: SVGElement) {
  return Array.from(target.children).find((child) => child.tagName.toLowerCase() === 'title') as SVGTitleElement | undefined
}

function normalizeSvgTargets(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGElement>('rect,circle,path').forEach((target) => {
    if (target.hasAttribute('data-chart-tooltip')) return
    const title = directSvgTitle(target)
    const text = title?.textContent?.trim()
    if (!text) return
    target.setAttribute('data-chart-tooltip', text)
    if (!target.hasAttribute('aria-label')) {
      target.setAttribute('aria-label', text.replace(/\n+/g, ' · '))
    }
    title.remove()
  })
}

function normalizeHtmlTargets(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[title]').forEach((target) => {
    if (target.hasAttribute('data-chart-tooltip')) return
    const text = target.getAttribute('title')?.trim()
    if (!text) return
    target.setAttribute('data-chart-tooltip', text)
    target.removeAttribute('title')
  })
}

function tooltipLines(raw: string) {
  const explicitLines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  if (explicitLines.length !== 1) return explicitLines

  const parts = explicitLines[0].split(' · ').map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) return explicitLines

  const first = parts[0]
  const separator = first.indexOf(': ')
  if (separator > 0) {
    return [first.slice(0, separator), `Valor: ${first.slice(separator + 2)}`, ...parts.slice(1)]
  }
  return parts
}

function renderTooltip(root: Element, target: Element, clientX: number, clientY: number, withLine = false) {
  const raw = target.getAttribute('data-chart-tooltip')?.trim() || ''
  const lines = tooltipLines(raw)
  if (!lines.length) return

  const state = ensureState(root, withLine)
  const wrap = tooltipContainer(root)
  if (!state || !wrap) return

  state.tooltip.innerHTML = ''
  const heading = document.createElement('strong')
  heading.textContent = lines[0]
  state.tooltip.appendChild(heading)

  lines.slice(1).forEach((line) => {
    const span = document.createElement('span')
    span.textContent = line
    state.tooltip.appendChild(span)
  })

  const rect = wrap.getBoundingClientRect()
  const pointerX = clientX - rect.left
  const pointerY = clientY - rect.top
  state.tooltip.style.left = '8px'
  state.tooltip.style.top = '8px'
  state.tooltip.style.visibility = 'hidden'
  state.tooltip.hidden = false

  const tooltipWidth = state.tooltip.offsetWidth
  const tooltipHeight = state.tooltip.offsetHeight
  const margin = 8
  const offset = 12

  let left = pointerX + offset
  if (left + tooltipWidth > rect.width - margin) left = pointerX - tooltipWidth - offset
  left = Math.min(Math.max(left, margin), Math.max(rect.width - tooltipWidth - margin, margin))

  let top = pointerY - tooltipHeight - offset
  if (top < margin) top = pointerY + offset
  top = Math.min(Math.max(top, margin), Math.max(rect.height - tooltipHeight - margin, margin))

  state.tooltip.style.left = `${left}px`
  state.tooltip.style.top = `${top}px`
  state.tooltip.style.visibility = 'visible'

  if (state.line && target instanceof SVGCircleElement) {
    const cx = target.getAttribute('cx') || '0'
    state.line.setAttribute('x1', cx)
    state.line.setAttribute('x2', cx)
    state.line.style.display = ''
  }
}

function hideTooltip(root: Element) {
  const state = states.get(root)
  if (!state) return
  state.tooltip.hidden = true
  state.tooltip.style.visibility = ''
  if (state.line) state.line.style.display = 'none'
}

function circlesWithTooltip(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll<SVGCircleElement>('circle[data-chart-tooltip]'))
}

function nearestCircle(svg: SVGSVGElement, clientX: number) {
  const circles = circlesWithTooltip(svg)
  if (!circles.length) return null

  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = 0
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const local = point.matrixTransform(ctm.inverse())

  return circles.reduce<{ circle: SVGCircleElement; distance: number } | null>((best, circle) => {
    const cx = Number(circle.getAttribute('cx') || 0)
    const distance = Math.abs(cx - local.x)
    if (!best || distance < best.distance) return { circle, distance }
    return best
  }, null)?.circle || null
}

function findTarget(root: Element, eventTarget: EventTarget | null) {
  if (!(eventTarget instanceof Element)) return null
  const target = eventTarget.closest('[data-chart-tooltip]')
  if (!target || !root.contains(target)) return null
  return target
}

function bindProjection(svg: SVGSVGElement) {
  normalizeSvgTargets(svg)
  if (svg.dataset.tooltipEnhanced === '1') return
  svg.dataset.tooltipEnhanced = '1'

  svg.addEventListener('pointermove', (event) => {
    const circle = nearestCircle(svg, event.clientX)
    if (!circle) {
      hideTooltip(svg)
      return
    }
    renderTooltip(svg, circle, event.clientX, event.clientY, true)
  })
  svg.addEventListener('pointerleave', () => hideTooltip(svg))
}

function bindAnalyticsSvg(svg: SVGSVGElement) {
  normalizeSvgTargets(svg)
  if (svg.dataset.tooltipEnhanced === '1') return
  svg.dataset.tooltipEnhanced = '1'

  svg.addEventListener('pointermove', (event) => {
    const target = findTarget(svg, event.target)
    if (!target) {
      hideTooltip(svg)
      return
    }
    renderTooltip(svg, target, event.clientX, event.clientY)
  })
  svg.addEventListener('pointerleave', () => hideTooltip(svg))
}

function bindAnalyticsHeatmap(root: HTMLElement) {
  normalizeHtmlTargets(root)
  if (root.dataset.tooltipEnhanced === '1') return
  root.dataset.tooltipEnhanced = '1'

  root.addEventListener('pointermove', (event) => {
    const target = findTarget(root, event.target)
    if (!target) {
      hideTooltip(root)
      return
    }
    renderTooltip(root, target, event.clientX, event.clientY)
  })
  root.addEventListener('pointerleave', () => hideTooltip(root))
}

function scan() {
  document.querySelectorAll<SVGSVGElement>('.dashboard-projection-chart').forEach(bindProjection)
  document.querySelectorAll<SVGSVGElement>('.analytics-svg').forEach(bindAnalyticsSvg)
  document.querySelectorAll<HTMLElement>('.analytics-heatmap').forEach(bindAnalyticsHeatmap)
}

export function enableProjectionTooltip() {
  if (typeof document === 'undefined') return
  scan()
  const observer = new MutationObserver(scan)
  observer.observe(document.body, { childList: true, subtree: true })
}
