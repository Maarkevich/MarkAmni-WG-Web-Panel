'use client';

import { useState, useEffect } from 'react';
import { Globe, Shield, ExternalLink, Trash2, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { api } from '@/lib/awg/client';
import { Card, CardHead } from './bits';

interface DomainSettings {
  name?: string;
  email?: string;
  sslEnabled?: boolean;
  nginxEnabled?: boolean;
  lastSetup?: string;
  lastError?: string;
  useDomainAsEndpoint?: boolean;
  useFakeSni?: boolean;
}

export default function DomainView({ toast }: { toast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [domain, setDomain] = useState<DomainSettings>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [useDomainEndpoint, setUseDomainEndpoint] = useState(false);
  const [useFakeSni, setUseFakeSni] = useState(false);
  const [savingOptions, setSavingOptions] = useState(false);

  useEffect(() => {
    api<{ domain: DomainSettings }>('/api/domain')
      .then(r => {
        setDomain(r.domain);
        if (r.domain.name) setName(r.domain.name);
        if (r.domain.email) setEmail(r.domain.email);
        if (r.domain.useDomainAsEndpoint) setUseDomainEndpoint(r.domain.useDomainAsEndpoint);
        if (r.domain.useFakeSni) setUseFakeSni(r.domain.useFakeSni);
      })
      .catch(() => {});
  }, []);

  const saveOptions = async (endpointVal: boolean, sniVal: boolean) => {
    setSavingOptions(true);
    try {
      const r = await api<{ ok: boolean; domain: DomainSettings }>('/api/domain', {
        json: { action: 'update-options', useDomainAsEndpoint: endpointVal, useFakeSni: sniVal }
      });
      if (r.ok) {
        setDomain(r.domain);
        toast('Настройки маскировки сохранены', 'success');
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSavingOptions(false);
    }
  };

  const handleSetup = async () => {
    if (!name.trim()) { toast('Введите домен', 'error'); return; }
    if (!email.trim() || !email.includes('@')) { toast('Введите корректный email', 'error'); return; }
    setLoading(true);
    try {
      const r = await api<{ ok: boolean; message: string; url?: string; error?: string }>('/api/domain', { json: { name, email } });
      if (r.ok) {
        toast(r.message, 'success');
        const updated = await api<{ domain: DomainSettings }>('/api/domain');
        setDomain(updated.domain);
      } else {
        toast(r.error || 'Ошибка настройки', 'error');
      }
    } catch (e) {
      toast((e as Error).message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Удалить домен и конфигурацию Nginx?')) return;
    setRemoving(true);
    try {
      const r = await api<{ ok: boolean; message: string }>('/api/domain', { json: { action: 'remove' } });
      toast(r.message, r.ok ? 'info' : 'error');
      if (r.ok) { setDomain({}); setName(''); }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setRemoving(false);
    }
  };

  const isConfigured = domain.sslEnabled && domain.nginxEnabled;

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Статус */}
      {isConfigured && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300">Домен настроен</p>
            <p className="text-xs text-emerald-300/70 mt-0.5 truncate">Панель доступна по адресу:</p>
            <a href={`https://${domain.name}`} target="_blank" rel="noreferrer"
              className="text-sm font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1">
              https://{domain.name} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Опции маскировки через домен */}
      {isConfigured && (
        <Card>
          <CardHead title="Маскировка через домен" icon={<Shield className="w-4 h-4" />}
            sub="Опции применяются к новым конфигам клиентов" />
          <div className="p-4 space-y-4">

            {/* Опция 1: Endpoint как домен */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">Домен в Endpoint клиентов</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Вместо IP-адреса в конфиге клиента будет указан домен.<br />
                  <span className="font-mono text-slate-400">Endpoint = {domain.name}:{'{port}'}</span><br />
                  При блокировке IP достаточно сменить DNS-запись — клиенты переподключатся без пересоздания конфигов.
                </p>
              </div>
              <button
                onClick={() => { const v = !useDomainEndpoint; setUseDomainEndpoint(v); void saveOptions(v, useFakeSni); }}
                disabled={savingOptions}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors ${useDomainEndpoint ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${useDomainEndpoint ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Опция 3: Fake SNI */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">Fake SNI (имитация HTTPS)</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Добавляет SNI-заголовок домена в конфиг — AWG-трафик выглядит как HTTPS к <span className="font-mono text-slate-400">{domain.name}</span>.<br />
                  DPI-системы видят обращение к легитимному домену, а не VPN-трафик.<br />
                  <span className="text-amber-400/80">Только для AWG 2.0 / 3.1.</span>
                </p>
              </div>
              <button
                onClick={() => { const v = !useFakeSni; setUseFakeSni(v); void saveOptions(useDomainEndpoint, v); }}
                disabled={savingOptions}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors ${useFakeSni ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${useFakeSni ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {savingOptions && <p className="text-xs text-slate-500 text-center">Сохраняем…</p>}

            <div className="text-xs text-slate-600 leading-relaxed px-1">
              ⚠️ Опции влияют только на <strong className="text-slate-500">новые</strong> конфиги. Уже скачанные конфиги клиентов нужно пересоздать (кнопка QR / Скачать в разделе Клиенты).
            </div>
          </div>
        </Card>
      )}

      {domain.lastError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-300">Ошибка при последней настройке</p>
            <p className="text-xs text-rose-300/70 mt-1 font-mono break-all">{domain.lastError}</p>
          </div>
        </div>
      )}

      {/* Инструкция: получить бесплатный домен */}
      <Card>
        <CardHead title="Бесплатный домен (freedns.afraid.org)" icon={<Globe className="w-4 h-4" />} />
        <div className="p-4 space-y-3 text-sm text-slate-300">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Для HTTPS-доступа к панели нужен домен. Получите бесплатный поддомен на сервисе freedns.afraid.org — это займёт 2 минуты.
            </p>
          </div>
          <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside leading-relaxed">
            <li>Зайдите на <a href="https://freedns.afraid.org" target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">freedns.afraid.org</a> и зарегистрируйтесь (бесплатно)</li>
            <li>Перейдите в <span className="text-slate-200 font-medium">Subdomains → Add</span></li>
            <li>Тип записи: <span className="text-slate-200 font-mono">A</span>, выберите любой домен из списка (например <span className="text-slate-200 font-mono">twilightparadox.com</span>)</li>
            <li>Придумайте имя (например <span className="text-slate-200 font-mono">mypanel</span>)</li>
            <li>В поле <span className="text-slate-200 font-medium">Destination</span> укажите IP вашего сервера</li>
            <li>Нажмите <span className="text-slate-200 font-medium">Save</span> — поддомен <span className="text-slate-200 font-mono">mypanel.twilightparadox.com</span> готов</li>
            <li>Подождите 1–2 минуты пока DNS обновится, затем введите домен ниже</li>
          </ol>
        </div>
      </Card>

      {/* Форма настройки */}
      <Card>
        <CardHead title="Настройка домена и SSL" icon={<Shield className="w-4 h-4" />}
          sub="Nginx + бесплатный сертификат Let's Encrypt" />
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Домен <span className="text-rose-400">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value.trim())}
              placeholder="mypanel.twilightparadox.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
            />
            <p className="text-[11px] text-slate-500 mt-1">Без http:// — только имя домена</p>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Email для SSL-сертификата <span className="text-rose-400">*</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value.trim())}
              placeholder="you@example.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
            />
            <p className="text-[11px] text-slate-500 mt-1">Нужен для получения сертификата Let&apos;s Encrypt. Уведомления об истечении придут на этот адрес.</p>
          </div>

          <div className="pt-1 flex gap-2">
            <button
              onClick={handleSetup}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {loading ? 'Настраиваем…' : isConfigured ? 'Обновить настройки' : 'Настроить HTTPS'}
            </button>
            {isConfigured && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 font-medium py-2.5 px-4 rounded-xl text-sm transition-colors border border-rose-500/20"
              >
                {removing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>

          {loading && (
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-400 space-y-1">
              <p>⏳ Проверяем DNS-запись домена…</p>
              <p>⏳ Устанавливаем Nginx (если нужно)…</p>
              <p>⏳ Получаем SSL-сертификат от Let&apos;s Encrypt…</p>
              <p className="text-slate-500">Это может занять 1–2 минуты. Не закрывайте страницу.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Инфо о сертификате */}
      {isConfigured && (
        <Card>
          <CardHead title="Информация о сертификате" icon={<Shield className="w-4 h-4" />} />
          <div className="p-4 space-y-2 text-xs text-slate-400">
            <div className="flex justify-between"><span>Провайдер</span><span className="text-slate-200">Let&apos;s Encrypt</span></div>
            <div className="flex justify-between"><span>Срок действия</span><span className="text-slate-200">90 дней</span></div>
            <div className="flex justify-between"><span>Автообновление</span><span className="text-emerald-300">Включено (certbot)</span></div>
            {domain.lastSetup && (
              <div className="flex justify-between">
                <span>Последняя настройка</span>
                <span className="text-slate-200">{new Date(domain.lastSetup).toLocaleString('ru-RU')}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
              Сертификат обновляется автоматически через systemd-таймер certbot. Вмешательство не требуется.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
