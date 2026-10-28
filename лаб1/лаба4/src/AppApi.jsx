import { useEffect, useState } from 'react'
import {
  addCurrency,
  deleteCurrency,
  fetchCurrencies,
  fetchProfile,
  login,
  refreshCurrencyRates,
  register,
  updateCurrency,
} from './api.js'
import './App.css'

const TOKEN_KEY = 'currency-radar-token'
const COLORS = ['#2e7564', '#bc684a', '#6678a4', '#ba8b38']
const SYMBOL_CHOICES = ['$', '€', '£', '¥', '₽', 'Br', '₹', '₩', '₺', '₴', '₸', '₪', '₫', '฿', '₱', '₦', '₲', '₡', '₭', '₮', '₾', '₼', '¢', '¤']
const EMPTY_DRAFT = { code: '', name: '', symbol: '', rateToRub: '' }

function toCurrency(item) {
  const knownColor = { RUB: COLORS[0], USD: COLORS[1], EUR: COLORS[2], CNY: COLORS[3], BYN: COLORS[0] }[item.id]
  const colorIndex = [...item.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % COLORS.length

  return {
    code: item.id,
    name: item.name,
    symbol: item.symbol || item.id,
    rateToRub: Number(item.rateToRub),
    color: knownColor || COLORS[colorIndex],
  }
}

function pluralizeCurrency(count) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'валют'
  if (lastDigit === 1) return 'валюта'
  if (lastDigit >= 2 && lastDigit <= 4) return 'валюты'
  return 'валют'
}

function formatRate(rate) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate)
}

function AppApi() {
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [editingCode, setEditingCode] = useState(null)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('code')
  const [formError, setFormError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncState, setSyncState] = useState('loading')
  const [savedAt, setSavedAt] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [auth, setAuth] = useState(() => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: null,
  }))
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    const controller = new AbortController()

    fetchCurrencies({ signal: controller.signal })
      .then((currencies) => {
        setItems(currencies.map(toCurrency))
        setSyncState('saved')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoadError(error.message)
          setSyncState('error')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [retryCount])

  useEffect(() => {
    if (!auth.token) return undefined

    const controller = new AbortController()
    fetchProfile(auth.token, { signal: controller.signal })
      .then((user) => setAuth((currentAuth) => ({ ...currentAuth, user })))
      .catch((error) => {
        if (error.name === 'AbortError') return
        localStorage.removeItem(TOKEN_KEY)
        setAuth({ token: '', user: null })
        setAuthError('Сессия истекла. Войдите снова.')
      })

    return () => controller.abort()
  }, [auth.token])

  useEffect(() => {
    document.title = `Валютный радар · ${items.length} ${pluralizeCurrency(items.length)}`
  }, [items.length])

  const isAdmin = auth.user?.role === 'admin'
  const visibleItems = items
    .filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((first, second) => {
      if (sortBy === 'rate') return first.rateToRub - second.rateToRub
      if (sortBy === 'name') return first.name.localeCompare(second.name, 'ru')
      return first.code.localeCompare(second.code)
    })

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
    setFormError('')
  }

  function startEditing(item) {
    setEditingCode(item.code)
    setDraft({
      code: item.code,
      name: item.name,
      symbol: item.symbol,
      rateToRub: String(item.rateToRub),
    })
    setFormError('')
  }

  function resetForm() {
    setEditingCode(null)
    setDraft(EMPTY_DRAFT)
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const code = draft.code.trim().toUpperCase()
    const name = draft.name.trim()
    const rateToRub = Number(String(draft.rateToRub).replace(',', '.'))
    const codeIsTaken = items.some((item) => item.code === code && item.code !== editingCode)

    if (!isAdmin || !auth.token) {
      setFormError('Войдите под учетной записью администратора для изменения валют.')
      return
    }
    if (!/^[A-Z]{3}$/.test(code)) {
      setFormError('Укажите код валюты из трех латинских букв.')
      return
    }
    if (!name || !Number.isFinite(rateToRub) || rateToRub <= 0) {
      setFormError('Заполните название и укажите курс больше нуля.')
      return
    }
    if (codeIsTaken) {
      setFormError('Валюта с таким кодом уже есть в списке.')
      return
    }

    const nextItem = {
      code,
      name,
      symbol: draft.symbol.trim() || code,
      rateToRub,
      color: items.find((item) => item.code === editingCode)?.color || COLORS[items.length % COLORS.length],
    }

    setNotice('')
    setSyncState('saving')

    if (editingCode) {
      const previousItem = items.find((item) => item.code === editingCode)
      setItems((currentItems) => currentItems.map((item) => (
        item.code === editingCode ? nextItem : item
      )))
      resetForm()

      try {
        const savedItem = toCurrency(await updateCurrency(editingCode, nextItem, auth.token))
        setItems((currentItems) => currentItems.map((item) => (
          item.code === savedItem.code ? savedItem : item
        )))
        markSaved('Изменения сохранены на сервере.')
      } catch (error) {
        setItems((currentItems) => currentItems.map((item) => (
          item.code === editingCode ? previousItem : item
        )))
        setSyncState('error')
        setNotice(`Изменение отменено: ${error.message}`)
      }
      return
    }

    const temporaryItem = { ...nextItem, pending: true }
    setItems((currentItems) => [...currentItems, temporaryItem])
    resetForm()

    try {
      const savedItem = toCurrency(await addCurrency(nextItem, auth.token))
      setItems((currentItems) => currentItems.map((item) => (
        item.code === code ? savedItem : item
      )))
      markSaved('Валюта добавлена на сервере.')
    } catch (error) {
      setItems((currentItems) => currentItems.filter((item) => item.code !== code))
      setSyncState('error')
      setNotice(`Добавление отменено: ${error.message}`)
    }
  }

  async function removeCurrency(code) {
    if (!isAdmin || !auth.token) return

    const index = items.findIndex((item) => item.code === code)
    const removedItem = items[index]
    setItems((currentItems) => currentItems.filter((item) => item.code !== code))
    if (editingCode === code) resetForm()
    setNotice('')
    setSyncState('saving')

    try {
      await deleteCurrency(code, auth.token)
      markSaved('Валюта удалена.')
    } catch (error) {
      setItems((currentItems) => {
        const restoredItems = [...currentItems]
        restoredItems.splice(Math.min(index, restoredItems.length), 0, removedItem)
        return restoredItems
      })
      setSyncState('error')
      setNotice(`Удаление отменено: ${error.message}`)
    }
  }

  function markSaved(message) {
    setSavedAt(new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()))
    setSyncState('saved')
    setNotice(message)
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')

    try {
      if (authMode === 'register') await register(authForm)
      const result = await login(authForm)
      const user = await fetchProfile(result.token)
      localStorage.setItem(TOKEN_KEY, result.token)
      setAuth({ token: result.token, user })
      setAuthForm({ email: '', password: '' })
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY)
    setAuth({ token: '', user: null })
    setAuthError('')
  }

  function retryLoading() {
    setLoading(true)
    setLoadError('')
    setRetryCount((count) => count + 1)
  }

  async function refreshRates() {
    setRefreshing(true)
    setNotice('')
    try {
      const result = await refreshCurrencyRates(auth.token)
      setItems(result.currencies.map(toCurrency))
      markSaved('Курсы обновлены по данным ЦБ РФ.')
    } catch (error) {
      setNotice(error.message)
      setSyncState('error')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Валютный радар, главная">
          <span className="brand-mark" aria-hidden="true">₽</span>
          <span>Курс<span className="brand-light">/</span>лист</span>
        </a>
        <div className="topbar-meta">
          <span className={`live-dot ${loadError ? 'status-error' : ''}`} aria-hidden="true" />
          {loadError ? 'Нет связи с API' : 'Данные сервера'}
        </div>
      </header>

      <section className="auth-strip" aria-label="Учетная запись">
        {auth.user ? (
          <div className="signed-in">
            <span className="auth-status-mark" aria-hidden="true">✓</span>
            <span className="signed-in-email">{auth.user.email}</span>
            <span className={`role-label ${isAdmin ? 'role-admin' : ''}`}>{isAdmin ? 'ADMIN' : 'USER'}</span>
            <button type="button" className="text-button" onClick={signOut}>Выйти</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="auth-mode" role="group" aria-label="Действие с учетной записью">
              <button type="button" className={authMode === 'login' ? 'selected' : ''} onClick={() => { setAuthMode('login'); setAuthError('') }}>Вход</button>
              <button type="button" className={authMode === 'register' ? 'selected' : ''} onClick={() => { setAuthMode('register'); setAuthError('') }}>Регистрация</button>
            </div>
            <label className="visually-hidden" htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" autoComplete="email" placeholder="Email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} required />
            <label className="visually-hidden" htmlFor="auth-password">Пароль</label>
            <input id="auth-password" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="Пароль" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} required />
            <button className="auth-submit" type="submit" disabled={authBusy}>
              {authBusy ? 'Проверка…' : authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </form>
        )}
        {authError && <p className="auth-error" role="alert">{authError}</p>}
      </section>

      <main id="top">
        <section className="page-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">КЛИЕНТ API · RUB</p>
            <h1 id="page-title">Валютный радар<span>.</span></h1>
            <p className="intro-copy">Управляйте списком валют и их курсами.</p>
          </div>
        </section>

        <section className="summary-strip" aria-label="Сводка списка">
          <div className="summary-item">
            <span className="summary-number">{items.length.toString().padStart(2, '0')}</span>
            <span className="summary-label">{pluralizeCurrency(items.length)} в списке</span>
          </div>
          <span className="summary-divider" aria-hidden="true" />
          <div className="summary-item">
            <span className="summary-number summary-base">RUB</span>
            <span className="summary-label">базовая валюта</span>
          </div>
          <span className="summary-divider" aria-hidden="true" />
          <div className="summary-item summary-status" aria-live="polite">
            <span className={`status-indicator status-${syncState}`} aria-hidden="true" />
            <span className="summary-label">
              {loading && 'Загрузка API'}
              {!loading && syncState === 'saving' && 'Отправка изменений'}
              {!loading && syncState === 'saved' && `Синхронизировано${savedAt ? ` в ${savedAt}` : ''}`}
              {!loading && syncState === 'error' && 'Ошибка синхронизации'}
              {!loading && syncState === 'loading' && 'Ожидание'}
            </span>
          </div>
        </section>

        {notice && <p className={`notice ${syncState === 'error' ? 'notice-error' : ''}`} role={syncState === 'error' ? 'alert' : 'status'}>{notice}</p>}

        <div className="workspace-grid">
          <section className="rates-section" aria-labelledby="rates-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">СЕРВЕРНЫЙ СПИСОК</p>
                <h2 id="rates-title">Курсы валют</h2>
              </div>
              <div className="heading-actions">
                <span className="rate-count">{items.length} {pluralizeCurrency(items.length)}</span>
                {isAdmin && <button className="refresh-button" type="button" onClick={refreshRates} disabled={refreshing}>{refreshing ? 'Обновление…' : 'Обновить курсы'}</button>}
              </div>
            </div>

            <div className="list-controls">
              <label className="search-field">
                <span className="search-icon" aria-hidden="true" />
                <span className="visually-hidden">Поиск валюты</span>
                <input type="search" placeholder="Найти валюту" value={query} onChange={(event) => setQuery(event.target.value)} />
                {query && <button className="clear-search" type="button" onClick={() => setQuery('')} aria-label="Очистить поиск">×</button>}
              </label>
              <label className="sort-field">
                <span className="sort-label">Сортировка</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Сортировка валют">
                  <option value="code">По коду</option>
                  <option value="name">По названию</option>
                  <option value="rate">По курсу</option>
                </select>
              </label>
            </div>

            <div className="currency-list" aria-live="polite" aria-busy={loading}>
              {loading ? (
                <div className="list-message"><span className="loading-spinner" aria-hidden="true" />Загружаем курсы с сервера…</div>
              ) : loadError ? (
                <div className="list-message list-error">
                  <strong>Не удалось загрузить список</strong>
                  <span>{loadError}</span>
                  <button className="retry-button" type="button" onClick={retryLoading}>Повторить</button>
                </div>
              ) : visibleItems.length > 0 ? visibleItems.map((item, index) => (
                <article className={`currency-row ${item.pending ? 'currency-pending' : ''}`} key={item.code} style={{ '--row-index': index }}>
                  <span className="currency-symbol" style={{ '--currency-color': item.color }} aria-hidden="true">{item.symbol}</span>
                  <div className="currency-identity">
                    <span className="currency-code">{item.code}{item.pending && <span className="pending-label"> отправка…</span>}</span>
                    <span className="currency-name">{item.name}</span>
                  </div>
                  <div className="currency-rate">
                    <span className="rate-value">{formatRate(item.rateToRub)}</span>
                    <span className="rate-caption">RUB за 1 {item.code}</span>
                  </div>
                  {isAdmin && <div className="row-actions">
                    <button type="button" className="row-action edit-action" onClick={() => startEditing(item)} aria-label={`Изменить ${item.name}`}>Изменить</button>
                    <button type="button" className="row-action delete-action" onClick={() => removeCurrency(item.code)} aria-label={`Удалить ${item.name}`}>Удалить</button>
                  </div>}
                </article>
              )) : (
                <div className="empty-state">
                  <span className="empty-mark" aria-hidden="true">?</span>
                  <strong>{items.length ? 'Ничего не найдено' : 'Список пока пуст'}</strong>
                  <span>{items.length ? 'Попробуйте другой код или название.' : 'Список валют вернулся с сервера пустым.'}</span>
                </div>
              )}
            </div>
          </section>

          <aside className="editor-panel" aria-labelledby="editor-title">
            {isAdmin ? (
              <>
                <div className="editor-heading">
                  <span className="editor-index">{editingCode ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ПОЗИЦИЯ'}</span>
                  <span className="editor-plus" aria-hidden="true">{editingCode ? '↗' : '+'}</span>
                </div>
                <h2 id="editor-title">{editingCode ? 'Изменить валюту' : 'Добавить валюту'}</h2>
                <form className="currency-form" onSubmit={handleSubmit}>
                  <label className="form-field">
                    <span>Код валюты</span>
                    <input type="text" value={draft.code} onChange={(event) => updateDraft('code', event.target.value)} maxLength={3} autoComplete="off" required disabled={Boolean(editingCode)} />
                  </label>
                  <label className="form-field">
                    <span>Название</span>
                    <input type="text" value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} maxLength={60} required />
                  </label>
                  <div className="symbol-picker">
                    <label className="form-field" htmlFor="currency-symbol">
                      <span>Знак валюты</span>
                      <input id="currency-symbol" type="text" value={draft.symbol} onChange={(event) => updateDraft('symbol', event.target.value)} maxLength={5} placeholder="Свой знак" />
                    </label>
                    <div className="symbol-grid" role="group" aria-label="Готовые символы валют">
                      {SYMBOL_CHOICES.map((symbol) => (
                        <button
                          key={symbol}
                          className={`symbol-choice ${draft.symbol === symbol ? 'selected' : ''}`}
                          type="button"
                          aria-label={`Выбрать символ ${symbol}`}
                          aria-pressed={draft.symbol === symbol}
                          onClick={() => updateDraft('symbol', symbol)}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="form-field">
                    <span>Курс к RUB</span>
                    <input type="number" value={draft.rateToRub} onChange={(event) => updateDraft('rateToRub', event.target.value)} min="0.0001" step="any" required />
                  </label>
                  {formError && <p className="form-error" role="alert">{formError}</p>}
                  <button className="submit-button" type="submit" disabled={syncState === 'saving'}>
                    <span>{editingCode ? 'Сохранить изменения' : 'Добавить в список'}</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                  {editingCode && <button className="cancel-button" type="button" onClick={resetForm}>Отменить редактирование</button>}
                </form>
              </>
            ) : (
              <>
                <div className="editor-heading">
                  <span className="editor-index">ДОСТУП К ДАННЫМ</span>
                  <span className="editor-plus" aria-hidden="true">⌁</span>
                </div>
                <h2 id="editor-title">Только чтение</h2>
                <p className="editor-description">Для добавления, изменения валют и обновления курсов войдите под учетной записью с ролью admin.</p>
                <div className="access-note">{auth.user ? 'Текущая роль: user' : 'Войдите в учетную запись выше.'}</div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}

export default AppApi