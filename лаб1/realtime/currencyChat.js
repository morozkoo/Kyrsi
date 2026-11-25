const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');

const rooms = new Set(['USD', 'EUR', 'BYN', 'CNY', 'RUB']);
const roomName = (code) => 'currency:' + code;

module.exports = function attachCurrencyChat(server, origin) {
  const io = new Server(server, { cors: { origin }, maxHttpBufferSize: 4096 });

  function notify(socket, code, action, count) {
    socket.to(roomName(code)).emit('chat:presence', {
      code, name: socket.data.name, action, count,
    });
  }

  io.on('connection', (socket) => {
    let lastMessage = 0;

    function leaveRoom() {
      const code = socket.data.code;
      if (!code) return;
      const room = roomName(code);
      socket.leave(room);
      socket.data.code = undefined;
      notify(socket, code, 'left', io.sockets.adapter.rooms.get(room)?.size ?? 0);
    }

    socket.on('chat:join', (payload, ack) => {
      if (typeof ack !== 'function') return;
      const code = payload?.code;
      const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
      if (!rooms.has(code) || !name || name.length > 32) {
        return ack({ ok: false, error: 'Выберите валюту и укажите имя от 1 до 32 символов.' });
      }
      const room = roomName(code);
      if (socket.data.code === code) {
        return ack({ ok: true, count: io.sockets.adapter.rooms.get(room).size });
      }
      leaveRoom();
      socket.data.code = code;
      socket.data.name = name;
      socket.join(room);
      const count = io.sockets.adapter.rooms.get(room).size;
      notify(socket, code, 'joined', count);
      ack({ ok: true, count });
    });

    socket.on('chat:leave', leaveRoom);

    socket.on('chat:send', (payload, ack) => {
      if (typeof ack !== 'function') return;
      const code = socket.data.code;
      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!code || payload?.code !== code || !text || text.length > 500) {
        return ack({ ok: false, error: 'Войдите в комнату и введите сообщение до 500 символов.' });
      }
      const now = Date.now();
      if (now - lastMessage < 400) {
        return ack({ ok: false, error: 'Подождите немного перед следующим сообщением.' });
      }
      lastMessage = now;
      io.to(roomName(code)).emit('chat:message', {
        id: randomUUID(), code, name: socket.data.name, text, sentAt: now,
      });
      ack({ ok: true });
    });

    socket.on('disconnect', leaveRoom);
  });

  return io;
};
