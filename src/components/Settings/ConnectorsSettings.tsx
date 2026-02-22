import { useEffect, useMemo, useState } from 'react'
import { Link2, Plug, PlugZap, Unplug, Wrench } from 'lucide-react'

export function ConnectorsSettings() {
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([])
  const [connections, setConnections] = useState<ConnectorConnection[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    const [nextTemplates, nextConnections] = await Promise.all([
      window.jelico.connectors.listTemplates(),
      window.jelico.connectors.listConnections(),
    ])
    setTemplates(nextTemplates)
    setConnections(nextConnections)
  }

  useEffect(() => {
    void reload()
  }, [])

  const byId = useMemo(() => new Map(connections.map((item) => [item.id, item])), [connections])

  async function connect(id: string) {
    setBusyId(id)
    try {
      await window.jelico.connectors.connectStub(id, `${id}-account`)
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  async function disconnect(id: string) {
    setBusyId(id)
    try {
      await window.jelico.connectors.disconnect(id)
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
          <Link2 className="w-5 h-5 text-accent" /> Connectors
        </h3>
        <p className="text-sm text-text-muted mt-1">
          Framework stubs for external integrations. OAuth/token flows can be plugged in next.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {templates.map((template) => {
          const state = byId.get(template.id)
          const connected = !!state?.connected
          const isBusy = busyId === template.id

          return (
            <div key={template.id} className="p-4 bg-bg-elevated rounded-lg border border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{template.label}</span>
                    <span className={`px-2 py-0.5 text-xs rounded ${template.status === 'beta' ? 'bg-info/15 text-info' : 'bg-bg-hover text-text-muted'}`}>
                      {template.status}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded bg-bg-hover text-text-muted">
                      {template.authType}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">{template.description}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {connected ? `Connected as ${state?.accountLabel || 'account'}` : 'Not connected'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {connected ? (
                    <button
                      onClick={() => void disconnect(template.id)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-sm text-warning hover:text-warning/90 hover:bg-bg-hover rounded-lg flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Unplug className="w-4 h-4" /> {isBusy ? 'Working...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={() => void connect(template.id)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-sm bg-accent text-black rounded-lg hover:bg-accent-bright transition-colors flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {template.status === 'beta' ? <PlugZap className="w-4 h-4" /> : <Plug className="w-4 h-4" />}
                      {isBusy ? 'Working...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 rounded-lg border border-border bg-bg-deep">
        <div className="flex items-center gap-2 text-text-primary font-medium">
          <Wrench className="w-4 h-4 text-accent" /> Next implementation step
        </div>
        <p className="text-sm text-text-secondary mt-1">
          Wire each connector to real OAuth/token handshakes, then expose scoped tools to the prompt box and sub-agent runtime.
        </p>
      </div>
    </div>
  )
}
