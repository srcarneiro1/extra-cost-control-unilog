type TooltipState = {
  tooltip: HTMLDivElement
  line: SVGLineElement
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const states = new WeakMap<SVGSVGElement, TooltipState>()

function ensureState(svg: SVGSVGElement): TooltipState {
  const existing = states.get(svg)
  if (existing) return existing

  const wrap = svg.closest('.dashboard-chart-wrap') as HTMLElement | null
  if (!wrap) throw new Error('Contêiner do gráfico não encontrado.')

  const tooltip = document.createElement('div')
  tooltip.className = 'dashboard-chart-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.hidden = true
  wrap.appendChild(tooltip)

  const line = document.createElementNS(SVG_NS, 'line')
  line.classList.add('dashboard-chart-hover-line')
  line.setAttribute('y1', '38')
  line.setAttribute('y2', '262')
  line.style.display = 'none'
  svg.appendChild(line)

  const state = { tooltip, line }
  states.set(svg, state)
  return state
}

function circlesWithTooltip(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll<SVGCircleElement>('circle')).filter((circle) => {
    return Boolean(circle.querySelector('title')?.textContent?.trim())
  })
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

function renderTooltip(svg: SVGSVGElement, circle: SVGCircleElement, clientX: number, clientY: number) {
  const state = ensureState(svg)
  const title = circle.querySelector('title')?.textContent || ''
  const lines = title.split('\n').filter(Boolean)
  if (!lines.length) return

  state.tooltip.innerHTML = ''
  const heading = document.createElement('strong')
  heading.textContent = lines[0]
  state.tooltip.appendChild(heading)
  lines.slice(1).forEach((line) => {
    const span = document.createElement('span')
    span.textContent = line
    state.tooltip.appendChild(span)
  })

  const wrap = svg.closest('.dashboard-chart-wrap') as HTMLElement
  const rect = wrap.getBoundingClientRect()
  const left = Math.min(Math.max(clientX - rect.left + 12, 8), Math.max(rect.width - 220, 8))
  const top = Math.min(Math.max(clientY - rect.top - 14, 8), Math.max(rect.height - 130, 8))
  state.tooltip.style.left = `${left}px`
  state.tooltip.style.top = `${top}px`
  state.tooltip.hidden = false

  const cx = circle.getAttribute('cx') || '0'
  state.line.setAttribute('x1', cx)
  state.line.setAttribute('x2', cx)
  state.line.style.display = ''
}

function hideTooltip(svg: SVGSVGElement) {
  const state = states.get(svg)
  if (!state) return
  state.tooltip.hidden = true
  state.line.style.display = 'none'
}

function bind(svg: SVGSVGElement) {
  if (svg.dataset.tooltipEnhanced === '1') return
  svg.dataset.tooltipEnhanced = '1'

  svg.addEventListener('pointermove', (event) => {
    const circle = nearestCircle(svg, event.clientX)
    if (!circle) return
    renderTooltip(svg, circle, event.clientX, event.clientY)
  })

  svg.addEventListener('pointerleave', () => hideTooltip(svg))
}

function scan() {
  document.querySelectorAll<SVGSVGElement>('.dashboard-projection-chart').forEach(bind)
}

export function enableProjectionTooltip() {
  if (typeof document === 'undefined') return
  scan()
  const observer = new MutationObserver(scan)
  observer.observe(document.body, { childList: true, subtree: true })
}
