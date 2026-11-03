import type { KeyboardInfo } from '../protocol/device'
import { hex32 } from '../protocol/packet'

/** Results of the read-only handshake: pass/fail checks plus the raw facts. */
export function DeviceInfo({ info }: { info: KeyboardInfo }) {
  const firmwareMatches = info.knownModel?.firmwareId === info.firmwareId
  const checks: { label: string; ok: boolean; detail: string }[] = [
    { label: 'Connection and checksums', ok: true, detail: 'All three replies arrived with valid checksums' },
    {
      label: 'Model recognized',
      ok: !!info.knownModel,
      detail: info.knownModel ? info.knownModel.name : `Unknown model ${info.modelId}`,
    },
    {
      label: 'Firmware ID matches',
      ok: firmwareMatches,
      detail: info.knownModel
        ? `Expected ${hex32(info.knownModel.firmwareId)}, got ${hex32(info.firmwareId)}`
        : 'No reference for this model',
    },
    { label: 'Model ID checksum', ok: info.modelCrcValid, detail: info.modelCrcValid ? 'Valid' : 'Mismatch' },
  ]

  return (
    <div className="device-info">
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.label} data-ok={c.ok}>
            <span className="check-icon" aria-hidden>{c.ok ? '✓' : '!'}</span>
            <span className="check-label">{c.label}</span>
            <span className="check-detail">{c.detail}</span>
          </li>
        ))}
      </ul>
      <dl className="facts">
        <dt>Device name</dt><dd>{info.productName || '—'}</dd>
        <dt>Model ID</dt><dd>{info.modelId}</dd>
        <dt>Firmware ID</dt><dd>{hex32(info.firmwareId)}</dd>
        <dt>Firmware version</dt><dd>v{info.firmwareVersion}</dd>
        <dt>Key slots</dt><dd>{info.bufferSizeA} × {info.bufferSizeB}</dd>
      </dl>
    </div>
  )
}
