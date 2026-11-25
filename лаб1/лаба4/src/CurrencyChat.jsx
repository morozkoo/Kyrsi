import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import './CurrencyChat.css'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const rooms = ['USD', 'EUR', 'BYN', 'CNY', 'RUB']
const time = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' })

export default function CurrencyChat() {
  const [name, setName] = useState('')
  const [profile, setProfile] = useState(null)
  const [room, setRoom] = useState('USD')
  const [count, setCount] = useState(null)
  const [entries, setEntries] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const socketRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    const socket = io(apiUrl.startsWith('/') ? undefined : apiUrl, { autoConnect: false })
    socketRef.current = socket
    const append = (entry) => {
      if (entry.code === room) setEntries((old) => [...old.slice(-99), entry])
    }
    socket.on('connect', () => {
      setError('')
      socket.timeout(5000).emit('chat:join', { code: room, name: profile.name }, (err, result) => {
        if (socketRef.current !== socket || !socket.connected) return
        if (err || !result?.ok) {
          setError(result?.error || 'Сервер не подтвердил вход в комнату.')
          return
        }
        setCount(result.count)
      })
    })
    socket.on('disconnect', () => setCount(null))
    socket.on('connect_error', () => setError('Чат недоступен. Повторяем подключение…'))
    socket.on('chat:message', append)
    socket.on('chat:presence', (event) => {
      if (event.code !== room) return
      setCount(event.count)
      append({
        ...event,
        id: crypto.randomUUID(),
        sentAt: Date.now(),
        system: true,
        text: event.name + (event.action === 'joined' ? ' присоединился к комнате' : ' покинул комнату'),
      })
    })
    socket.connect()
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [profile, room])

  function selectRoom(code) {
    if (code === room) return
    socketRef.current?.emit('chat:leave')
    setRoom(code)
    setCount(null)
    setEntries([])
    setDraft('')
    setError('')
  }

  function send(event) {
    event.preventDefault()
    const socket = socketRef.current
    const text = draft.trim()
    if (!socket?.connected || count === null || !text) return
    setError('')
    socket.timeout(5000).emit('chat:send', { code: room, text }, (err, result) => {
      if (socketRef.current !== socket) return
      if (err || !result?.ok) {
        setError(result?.error || 'Сервер не подтвердил отправку.')
        return
      }
      setDraft((current) => current.trim() === text ? '' : current)
    })
  }

  return (
    <section className="currency-chat" aria-labelledby="currency-chat-title">
      <header className="currency-chat-header">
        <h2 id="currency-chat-title">Обсуждение курсов</h2>
        {profile && (
          <span role="status">{count === null ? 'Подключение…' : 'В комнате: ' + count}</span>
        )}
      </header>
      <div className="currency-chat-rooms" aria-label="Комнаты валют">
        {rooms.map((code) => (
          <button key={code} type="button" aria-pressed={code === room} onClick={() => selectRoom(code)}>
            {code}
          </button>
        ))}
      </div>
      {profile ? (
        <>
          <div className="currency-chat-feed" role="log" aria-label={'Сообщения ' + room}>
            {!entries.length && <p>В этой сессии пока нет сообщений.</p>}
            {entries.map((entry) => (
              <p key={entry.id} className={entry.system ? 'currency-chat-system' : undefined}>
                <time>{time.format(entry.sentAt)}</time>
                {!entry.system && <strong>{entry.name}</strong>}
                <span>{entry.text}</span>
              </p>
            ))}
          </div>
          <form className="currency-chat-form" onSubmit={send}>
            <input aria-label="Сообщение" placeholder={'Сообщение в ' + room}
              maxLength={500} value={draft} onChange={(event) => setDraft(event.target.value)} />
            <button type="submit" disabled={count === null || !draft.trim()}>Отправить</button>
            <button type="button" onClick={() => {
              socketRef.current?.emit('chat:leave')
              setProfile(null)
              setCount(null)
              setEntries([])
              setDraft('')
              setError('')
            }}>Выйти</button>
          </form>
        </>
      ) : (
        <form className="currency-chat-form" onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) setProfile({ name: name.trim() })
        }}>
          <input aria-label="Имя для чата" placeholder="Имя для чата" required maxLength={32}
            value={name} onChange={(event) => setName(event.target.value)} />
          <button type="submit" disabled={!name.trim()}>Войти в {room}</button>
        </form>
      )}
      {error && <p className="currency-chat-error" role="alert">{error}</p>}
    </section>
  )
}
