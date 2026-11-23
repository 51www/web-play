import { Icon } from './Icon';

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  ['空格 / K', '播放或暂停'],
  ['J / L', '后退 / 前进 10 秒'],
  ['← / →', '后退 / 前进 5 秒'],
  ['↑ / ↓', '音量增减'],
  ['M', '静音切换'],
  ['F', '全屏切换'],
  ['P', '画中画切换'],
  ['S', '当前画面截图'],
  ['C', '弹幕显示切换'],
  ['V', '字幕显示切换'],
  ['N / B', '下一集 / 上一集'],
  ['[ / ]', '降低 / 提高倍速'],
  ['?', '打开本帮助'],
  ['Esc', '关闭面板'],
];

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  return (
    <div className={`drawer-backdrop${open ? ' open' : ''}`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="drawer compact" role="dialog" aria-label="快捷键帮助" aria-hidden={!open}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">SHORTCUTS / GUIDE</p>
            <h2>操作指南</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭"><Icon name="close" /></button>
        </header>

        <div className="field-block">
          <label>键盘快捷键</label>
          <div className="help-grid">
            {shortcuts.map(([key, label]) => (
              <div className="help-row" key={key}>
                <kbd>{key}</kbd>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="hint">输入框获得焦点时快捷键不会触发；调色板、文件选择等系统弹窗也不受影响。</p>
        </div>

        <div className="field-block">
          <label>使用提示</label>
          <ul className="help-tips">
            <li>拖入视频或整个文件夹即可快速建立片单，同名字幕会自动挂载。</li>
            <li>弹幕面板的「弹幕列表」支持按时间跳转；本项目不提供发送弹幕。</li>
            <li>播放器右上角可切换倍速、字幕、截图、画中画与视频信息。</li>
            <li>进度条悬停可预览缩略图，缩略图只在当前会话内缓存。</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
