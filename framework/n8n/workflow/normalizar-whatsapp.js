// Nodo "Normalizar mensaje": convierte el webhook de WhatsApp Cloud en { message } con la forma que entiende el bot.
// Los avisos de estado (enviado, entregado, leído) no traen "messages" y se ignoran (el flujo termina sin responder).
const out = [];
for (const it of $input.all()) {
  const v = it.json || {};
  const m = (v.messages || [])[0];
  if (!m) continue;
  const message = { chat: { id: m.from }, message_id: m.id, phone_number_id: v.metadata ? v.metadata.phone_number_id : '', nombre: ((v.contacts || [])[0] || {}).profile?.name || '' };
  const tipo = m.type;
  if (tipo === 'text') message.text = m.text.body;
  else if (tipo === 'image') { message.photo = [{ file_id: m.image.id }]; message.caption = m.image.caption || ''; }
  else if (tipo === 'location') message.location = { latitude: m.location.latitude, longitude: m.location.longitude };
  else if (tipo === 'audio') message.voice = { file_id: m.audio.id };
  else if (tipo === 'video') { message.video = { file_id: m.video.id }; message.caption = m.video.caption || ''; }
  else if (tipo === 'document') { message.document = { file_id: m.document.id }; message.caption = m.document.caption || ''; }
  else if (tipo === 'button') message.text = m.button.text;
  else if (tipo === 'interactive') message.text = ((m.interactive || {}).button_reply || (m.interactive || {}).list_reply || {}).title || '';
  else if (tipo === 'sticker' || tipo === 'reaction') message.text = '🙂';
  else continue; // tipos no soportados (contactos, pedidos de catálogo…): no responder
  out.push({ json: { message } });
}
return out;
