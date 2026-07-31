import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, CheckCircle, Code, Plug, Robot, WarningCircle } from "@phosphor-icons/react";
import { getProviderConnections, PROVIDER_IDS, startProviderEnrollment } from "./provider-client.js";

const ICONS = { "mimo-code": Code, "codex-cli": Robot };

function ProviderCard({ provider, authorityConfigured, busy, onConnect }) {
  const Icon = ICONS[provider.id];
  const connected = provider.status === "connected";
  const pending = provider.status === "pending";
  const disabled = busy || connected || pending || !authorityConfigured;
  return <article className="provider-card functional-card">
    <div className="provider-icon"><Icon size={23} /></div>
    <div className="provider-copy">
      <div><strong>{provider.displayName}</strong><span className={`provider-status ${provider.status}`}>{connected ? <CheckCircle size={15} /> : <WarningCircle size={15} />}{provider.statusLabel}</span></div>
      <p>{provider.detail}</p>
      {provider.lastVerifiedAt ? <small>Последняя проверка: {new Date(provider.lastVerifiedAt).toLocaleString("ru-RU")}</small> : null}
    </div>
    <button className="secondary-button" type="button" disabled={disabled} onClick={() => onConnect(provider.id)}>
      {busy ? <ArrowClockwise className="spin" size={17} /> : <Plug size={17} />}
      {connected ? "Подключён" : pending ? "Запрос отправлен" : "Подключить"}
    </button>
  </article>;
}

export function AgentConnections({ session, selectedProfile, onSelectedProfile }) {
  const isOwner = session?.authenticated && session.user?.isPlatformOwner;
  const [connections, setConnections] = useState(null);
  const [loading, setLoading] = useState(Boolean(isOwner));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal) => {
    if (!isOwner) {
      setConnections(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      setConnections(await getProviderConnections({ signal }));
    } catch (error) {
      if (error?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "Статус провайдеров недоступен.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const connect = async (providerId) => {
    setBusy(providerId);
    setMessage("");
    try {
      const provider = await startProviderEnrollment(providerId);
      setConnections((current) => current ? {
        ...current,
        providers: current.providers.map((candidate) => candidate.id === providerId ? provider : candidate),
      } : current);
      setMessage(provider.status === "connected" ? `${provider.displayName} подключён.` : `Запрос на подключение ${provider.displayName} отправлен серверному контуру.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Подключение не выполнено.");
    } finally {
      setBusy("");
    }
  };

  return <section className="settings-section">
    <div className="settings-section-heading"><Robot size={24} /><div><h2>Модели и подключения</h2><p>Браузер выбирает профиль, но секреты и авторизация остаются на Provider Execution Authority.</p></div></div>
    <div className="agent-profile-selector functional-card" role="radiogroup" aria-label="Модель по умолчанию">
      {[{ id: "auto", label: "Авто", detail: "Kolibri выберет доступный контур" }, { id: "mimo-code", label: "MiMo Code", detail: "Быстрые расчёты и повседневные задачи" }, { id: "codex-cli", label: "Codex", detail: "Сложные задачи и работа с проектом" }].map((item) =>
        <button key={item.id} type="button" role="radio" aria-checked={selectedProfile === item.id} className={selectedProfile === item.id ? "active" : ""} onClick={() => onSelectedProfile(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>,
      )}
    </div>
    {!session?.authenticated ? <p className="settings-note">Сначала войдите в аккаунт Kolibri.</p> : !isOwner ? <p className="settings-note">Подключениями управляет владелец платформы. Вы можете выбирать уже доступные модели.</p> : loading ? <div className="settings-state"><ArrowClockwise className="spin" size={20} /> Загружаем состояние провайдеров…</div> : <>
      {connections && !connections.authorityConfigured ? <p className="settings-note warning">Provider Execution Authority не настроен. Кнопки подключения остаются заблокированными, чтобы приложение не подменяло серверный контур браузерным ключом.</p> : null}
      <div className="provider-list">
        {(connections?.providers ?? PROVIDER_IDS.map((id) => ({ id, displayName: id, status: "not_configured", statusLabel: "Не подключён", detail: "Состояние не загружено", authFlowSupported: false, lastVerifiedAt: null }))).map((provider) =>
          <ProviderCard key={provider.id} provider={provider} authorityConfigured={connections?.authorityConfigured === true} busy={busy === provider.id} onConnect={connect} />,
        )}
      </div>
      <button className="text-button" type="button" disabled={Boolean(busy)} onClick={() => void load()}><ArrowClockwise size={16} /> Обновить состояние</button>
    </>}
    {message ? <p className="inline-message" role="status">{message}</p> : null}
  </section>;
}
