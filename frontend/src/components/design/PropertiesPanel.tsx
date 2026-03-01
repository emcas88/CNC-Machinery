import { PropertyPanel } from '@/components/common/PropertyPanel'

interface NumericInputProps {
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
  unit?: string
}

function NumericInput({ value, onChange, min = 0, step = 1, unit }: NumericInputProps) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input-field w-20 text-right text-xs py-0.5"
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  )
}

export interface CabinetDimensions {
  width: number
  height: number
  depth: number
}

export interface CabinetProperties {
  dimensions: CabinetDimensions
  material: string
  finish: string
  doorCount: number
  drawerCount: number
}

interface PropertiesPanelProps {
  properties: CabinetProperties
  onChange: (props: CabinetProperties) => void
}

export function PropertiesPanel({ properties, onChange }: PropertiesPanelProps) {
  const update = (partial: Partial<CabinetProperties>) =>
    onChange({ ...properties, ...partial })

  const updateDim = (dim: Partial<CabinetDimensions>) =>
    update({ dimensions: { ...properties.dimensions, ...dim } })

  return (
    <PropertyPanel title="Cabinet Properties">
      <PropertyPanel.Section title="Dimensions">
        <PropertyPanel.Row label="Width">
          <NumericInput
            value={properties.dimensions.width}
            onChange={(v) => updateDim({ width: v })}
            unit="mm"
          />
        </PropertyPanel.Row>
        <PropertyPanel.Row label="Height">
          <NumericInput
            value={properties.dimensions.height}
            onChange={(v) => updateDim({ height: v })}
            unit="mm"
          />
        </PropertyPanel.Row>
        <PropertyPanel.Row label="Depth">
          <NumericInput
            value={properties.dimensions.depth}
            onChange={(v) => updateDim({ depth: v })}
            unit="mm"
          />
        </PropertyPanel.Row>
      </PropertyPanel.Section>

      <PropertyPanel.Section title="Finish">
        <PropertyPanel.Row label="Material">
          <input
            type="text"
            value={properties.material}
            onChange={(e) => update({ material: e.target.value })}
            className="input-field w-full text-xs py-0.5"
          />
        </PropertyPanel.Row>
        <PropertyPanel.Row label="Finish">
          <input
            type="text"
            value={properties.finish}
            onChange={(e) => update({ finish: e.target.value })}
            className="input-field w-full text-xs py-0.5"
          />
        </PropertyPanel.Row>
      </PropertyPanel.Section>

      <PropertyPanel.Section title="Hardware">
        <PropertyPanel.Row label="Doors">
          <NumericInput
            value={properties.doorCount}
            onChange={(v) => update({ doorCount: v })}
            min={0}
          />
        </PropertyPanel.Row>
        <PropertyPanel.Row label="Drawers">
          <NumericInput
            value={properties.drawerCount}
            onChange={(v) => update({ drawerCount: v })}
            min={0}
          />
        </PropertyPanel.Row>
      </PropertyPanel.Section>
    </PropertyPanel>
  )
}
