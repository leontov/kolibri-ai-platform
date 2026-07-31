import { useState } from "react";
import { ArrowClockwise, SignIn, SignOut, UserCircle } from "@phosphor-icons/react";
import { accountInitials, loginAccount, logoutAccount, registerAccount } from "./account-client.js";

export function AccountPanel({ session, sessionStatus, onSessionChange, onRefresh }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const next = mode === "login"
        ? await loginAccount({ email, password })
        : await registerAccount({ email, name, password });
      setPassword("");
      onSessionChange(next);
      setMessage(mode === "login" ? "Вход выполнен." : "Аккаунт создан.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подтвердить аккаунт.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setMessage("");
    try {
      await logoutAccount();
      onSessionChange({ authenticated: false, user: null });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось выйти.");
    } finally {
      setBusy(false);
    }
  };

  if (sessionStatus === "loading") {
    return <div className="settings-state" role="status"><ArrowClockwise className="spin" size={20} /> Проверяем защищённую сессию…</div>;
  }

  if (session?.authenticated && session.user) {
    return <section className="settings-section">
      <div className="settings-section-heading"><UserCircle size={24} /><div><h2>Аккаунт</h2><p>Сессия принадлежит backend Kolibri и передаётся только HttpOnly-cookie.</p></div></div>
      <div className="account-card functional-card">
        <span className="account-avatar-large">{accountInitials(session.user)}</span>
        <div><strong>{session.user.name}</strong><span>{session.user.email}</span><small>{session.user.isPlatformOwner ? "Владелец платформы" : "Пользователь"}</small></div>
        <button className="secondary-button" type="button" disabled={busy} onClick={logout}><SignOut size={17} /> Выйти</button>
      </div>
      {message ? <p className="inline-message" role="status">{message}</p> : null}
    </section>;
  }

  return <section className="settings-section">
    <div className="settings-section-heading"><SignIn size={24} /><div><h2>Вход в Kolibri</h2><p>Войдите, чтобы использовать AG-UI, долговечные чаты и подключённые модели.</p></div></div>
    <div className="auth-tabs" role="tablist" aria-label="Способ входа">
      <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Вход</button>
      <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Регистрация</button>
    </div>
    <form className="auth-form functional-card" onSubmit={submit}>
      {mode === "register" ? <label>Имя<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={160} autoComplete="name" required /></label> : null}
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} autoComplete="email" required /></label>
      <label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={256} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? <ArrowClockwise className="spin" size={17} /> : <SignIn size={17} />}{mode === "login" ? "Войти" : "Создать аккаунт"}</button>
      {message ? <p className="inline-message" role="alert">{message}</p> : null}
    </form>
    {sessionStatus === "error" ? <button className="text-button" type="button" onClick={onRefresh}><ArrowClockwise size={16} /> Повторить проверку backend</button> : null}
  </section>;
}
