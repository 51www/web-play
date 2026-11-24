import { PLAYBACK_RATES } from '../types';
import type { AppSettings, DanmakuSettings, PictureSettings } from '../types';
import { Icon } from './Icon';

interface SettingsPanelProps {
  open: boolean;
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onDanmakuChange: (patch: Partial<DanmakuSettings>) => void;
  onReset: () => void;
  onClearCache: () => void;
  onClose: () => void;
}

export function SettingsPanel({ open, settings, onChange, onDanmakuChange, onReset, onClearCache, onClose }: SettingsPanelProps) {
  return (
    <div className={`drawer-backdrop${open ? ' open' : ''}`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="drawer compact" role="dialog" aria-label="偏好设置" aria-hidden={!open}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">PREFERENCES</p>
            <h2>偏好设置</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭"><Icon name="close" /></button>
        </header>

        <div className="field-block">
          <label>播放行为</label>
          <div className="switch-grid">
            <label className="switch-row"><span>播完自动下一集</span><input type="checkbox" checked={settings.autoNext} onChange={(event) => onChange({ autoNext: event.target.checked })} /></label>
            <label className="switch-row"><span>单集循环</span><input type="checkbox" checked={settings.loop} onChange={(event) => onChange({ loop: event.target.checked })} /></label>
            <label className="switch-row"><span>随机播放</span><input type="checkbox" checked={settings.shuffle} onChange={(event) => onChange({ shuffle: event.target.checked })} /></label>
          </div>
          <div className="field-row playback-field-row">
            <label>默认倍速
              <select value={settings.playbackRate} onChange={(event) => onChange({ playbackRate: Number(event.target.value) })}>
                {PLAYBACK_RATES.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
              </select>
            </label>
            <label>去片头（秒）
              <input type="number" min={0} step={1} value={settings.skipIntro} onChange={(event) => onChange({ skipIntro: Math.max(0, Number(event.target.value) || 0) })} />
            </label>
            <label>去片尾（秒）
              <input type="number" min={0} step={1} value={settings.skipOutro} onChange={(event) => onChange({ skipOutro: Math.max(0, Number(event.target.value) || 0) })} />
            </label>
          </div>
          <p className="hint">设为 0 表示不跳过。播放时会自动略过片头与片尾对应时长；单集循环时片尾会回到片头之后。</p>
        </div>

        <div className="field-block">
          <label>画质</label>
          <div className="switch-grid">
            <label className="switch-row wide"><span>画质增强（补偿浏览器偏灰的色彩还原）</span><input type="checkbox" checked={settings.picture.enhance} onChange={(event) => onChange({ picture: { ...settings.picture, enhance: event.target.checked } })} /></label>
          </div>
          <div className="field-row playback-field-row picture-field-row">
            <label>亮度
              <input type="range" min={0.8} max={1.4} step={0.02} value={settings.picture.brightness} disabled={!settings.picture.enhance} onChange={(event) => onChange({ picture: { ...settings.picture, brightness: Number(event.target.value) } })} />
              <span className="mono">{settings.picture.brightness.toFixed(2)}</span>
            </label>
            <label>对比度
              <input type="range" min={0.8} max={1.4} step={0.02} value={settings.picture.contrast} disabled={!settings.picture.enhance} onChange={(event) => onChange({ picture: { ...settings.picture, contrast: Number(event.target.value) } })} />
              <span className="mono">{settings.picture.contrast.toFixed(2)}</span>
            </label>
            <label>饱和度
              <input type="range" min={0.8} max={1.6} step={0.02} value={settings.picture.saturation} disabled={!settings.picture.enhance} onChange={(event) => onChange({ picture: { ...settings.picture, saturation: Number(event.target.value) } })} />
              <span className="mono">{settings.picture.saturation.toFixed(2)}</span>
            </label>
          </div>
          <p className="hint">Web 播放时浏览器对色彩空间（BT.601/709、limited range）的处理常比本地播放器偏灰。开启后会轻度提升对比与饱和度，可按片源微调。</p>
        </div>

        <div className="field-block">
          <label>字幕与截图</label>
          <div className="switch-grid">
            <label className="switch-row"><span>启用字幕</span><input type="checkbox" checked={settings.subtitle.enabled} onChange={(event) => onChange({ subtitle: { ...settings.subtitle, enabled: event.target.checked } })} /></label>
            <label className="switch-row"><span>截图包含弹幕</span><input type="checkbox" checked={settings.screenshotWithDanmaku} onChange={(event) => onChange({ screenshotWithDanmaku: event.target.checked })} /></label>
          </div>
          <div className="field-row playback-field-row">
            <label>字幕字号
              <input type="number" min={14} max={48} value={settings.subtitle.fontSize} onChange={(event) => onChange({ subtitle: { ...settings.subtitle, fontSize: Number(event.target.value) || 22 } })} />
            </label>
            <label>字幕颜色
              <input type="color" value={settings.subtitle.color} onChange={(event) => onChange({ subtitle: { ...settings.subtitle, color: event.target.value } })} />
            </label>
            <label>底部距离（px）
              <input type="number" min={0} max={120} value={settings.subtitle.bottom} onChange={(event) => onChange({ subtitle: { ...settings.subtitle, bottom: Math.max(0, Number(event.target.value) || 0) } })} />
            </label>
            <label>时间微调（秒）
              <input type="number" step={0.1} value={settings.subtitle.delay} onChange={(event) => onChange({ subtitle: { ...settings.subtitle, delay: Number(event.target.value) || 0 } })} />
            </label>
          </div>
          <p className="hint">字幕可通过播放器右上角「挂载字幕」按钮添加，支持 SRT/VTT；同名字幕会在导入视频时自动挂载。</p>
        </div>

        <div className="field-block">
          <label>弹幕接口</label>
          <label>API 地址（可含访问参数）
            <input value={settings.danmaku.apiBase} onChange={(event) => onDanmakuChange({ apiBase: event.target.value })} />
          </label>
          <p className="hint">弹幕关键词会发送给该服务。静态站点直连接口，需要接口开放 CORS。</p>
          <label>缓存时长（毫秒）
            <input type="number" min={0} step={60000} value={settings.danmaku.cacheTTL} onChange={(event) => onDanmakuChange({ cacheTTL: Number(event.target.value) || 0 })} />
          </label>
          <button className="button quiet" onClick={onClearCache}><Icon name="refresh" size={16} /> 清空弹幕缓存</button>
        </div>

        <div className="field-block">
          <label>弹幕显示区域（占画面比例）</label>
          <div className="field-row">
            <label>上边距 <input type="number" min={0} max={45} value={settings.danmaku.topMargin} onChange={(event) => onDanmakuChange({ topMargin: Number(event.target.value) || 0 })} />%</label>
            <label>下边距 <input type="number" min={0} max={45} value={settings.danmaku.bottomMargin} onChange={(event) => onDanmakuChange({ bottomMargin: Number(event.target.value) || 0 })} />%</label>
          </div>
        </div>

        <div className="drawer-actions">
          <button className="button quiet danger" onClick={() => {
            if (window.confirm('恢复默认设置？')) onReset();
          }}>恢复默认设置</button>
        </div>
      </section>
    </div>
  );
}
