#!/usr/bin/env python3
"""
AIFX Admin Dashboard - WebSocket Desktop Application
透過 WebSocket 連接伺服器的桌面管理應用程式
"""

import tkinter as tk
from tkinter import ttk, messagebox
import socketio
import threading
import json
from datetime import datetime

class AIFXAdminWSApp:
    def __init__(self, root):
        self.root = root
        self.root.title("AIFX Admin Dashboard (WebSocket)")
        self.root.geometry("900x650")
        self.root.minsize(800, 600)

        # Socket.IO client
        self.sio = socketio.Client()
        self.connected = False
        self.authenticated = False
        self.token = None

        # 設定樣式
        self.setup_styles()

        # 設定 Socket.IO 事件
        self.setup_socket_events()

        # 顯示登入畫面
        self.show_login()

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('Title.TLabel', font=('Arial', 18, 'bold'))
        style.configure('Header.TLabel', font=('Arial', 12, 'bold'))
        style.configure('Status.TLabel', font=('Arial', 10))
        style.configure('Success.TLabel', foreground='green')
        style.configure('Error.TLabel', foreground='red')
        style.configure('Connected.TLabel', foreground='green', font=('Arial', 9))
        style.configure('Disconnected.TLabel', foreground='red', font=('Arial', 9))

    def setup_socket_events(self):
        @self.sio.event
        def connect():
            self.connected = True
            self.update_connection_status()
            print("[WS] Connected to server")

        @self.sio.event
        def disconnect():
            self.connected = False
            self.authenticated = False
            self.update_connection_status()
            print("[WS] Disconnected from server")

        @self.sio.on('admin:login:response')
        def on_login_response(data):
            self.root.after(0, lambda: self.handle_login_response(data))

        @self.sio.on('admin:auth:response')
        def on_auth_response(data):
            self.root.after(0, lambda: self.handle_auth_response(data))

        @self.sio.on('admin:health:response')
        def on_health_response(data):
            self.root.after(0, lambda: self.handle_data_response('health', data))

        @self.sio.on('admin:stats:response')
        def on_stats_response(data):
            self.root.after(0, lambda: self.handle_data_response('stats', data))

        @self.sio.on('admin:users:response')
        def on_users_response(data):
            self.root.after(0, lambda: self.handle_data_response('users', data))

        @self.sio.on('admin:user:update:response')
        def on_user_update_response(data):
            self.root.after(0, lambda: self.handle_user_update_response(data))

        @self.sio.on('admin:signals:response')
        def on_signals_response(data):
            self.root.after(0, lambda: self.handle_data_response('signals', data))

        @self.sio.on('admin:ml:models:response')
        def on_ml_models_response(data):
            self.root.after(0, lambda: self.handle_data_response('ml_models', data))

        @self.sio.on('admin:ml:status:response')
        def on_ml_status_response(data):
            self.root.after(0, lambda: self.handle_data_response('ml_status', data))

        @self.sio.on('error')
        def on_error(data):
            print(f"[WS] Error: {data}")

    def update_connection_status(self):
        if hasattr(self, 'connection_label'):
            if self.connected:
                self.connection_label.config(text="● 已連接", style='Connected.TLabel')
            else:
                self.connection_label.config(text="● 未連接", style='Disconnected.TLabel')

    def show_login(self):
        for widget in self.root.winfo_children():
            widget.destroy()

        main_frame = ttk.Frame(self.root, padding=40)
        main_frame.place(relx=0.5, rely=0.5, anchor='center')

        ttk.Label(main_frame, text="AIFX Admin", style='Title.TLabel').pack(pady=(0, 5))
        ttk.Label(main_frame, text="WebSocket 版本", style='Status.TLabel').pack(pady=(0, 30))

        # 伺服器地址
        ttk.Label(main_frame, text="伺服器地址:").pack(anchor='w')
        self.server_entry = ttk.Entry(main_frame, width=45)
        self.server_entry.insert(0, "https://heating-things-dsl-placing.trycloudflare.com")
        self.server_entry.pack(pady=(5, 15))

        # 帳號
        ttk.Label(main_frame, text="帳號:").pack(anchor='w')
        self.username_entry = ttk.Entry(main_frame, width=45)
        self.username_entry.insert(0, "admin")
        self.username_entry.pack(pady=(5, 15))

        # 密碼
        ttk.Label(main_frame, text="密碼:").pack(anchor='w')
        self.password_entry = ttk.Entry(main_frame, width=45, show="*")
        self.password_entry.pack(pady=(5, 20))

        # 登入按鈕
        self.login_btn = ttk.Button(main_frame, text="連接並登入", command=self.connect_and_login)
        self.login_btn.pack(pady=10, ipadx=20, ipady=5)

        # 狀態
        self.login_status = ttk.Label(main_frame, text="")
        self.login_status.pack(pady=10)

        # 連線狀態
        self.connection_label = ttk.Label(main_frame, text="● 未連接", style='Disconnected.TLabel')
        self.connection_label.pack(pady=5)

        self.password_entry.bind('<Return>', lambda e: self.connect_and_login())

    def connect_and_login(self):
        server_url = self.server_entry.get().rstrip('/')
        username = self.username_entry.get()
        password = self.password_entry.get()

        if not all([server_url, username, password]):
            self.login_status.config(text="請填寫所有欄位", style='Error.TLabel')
            return

        self.login_btn.config(state='disabled')
        self.login_status.config(text="連接中...", style='Status.TLabel')

        # 儲存認證資訊
        self._pending_auth = {'username': username, 'password': password}

        # 在背景執行連接
        def connect_thread():
            try:
                if self.sio.connected:
                    self.sio.disconnect()

                # 連接到 /admin-ws namespace
                self.sio.connect(server_url, namespaces=['/admin-ws'])

                # 連接成功後發送登入請求
                self.sio.emit('admin:login', {
                    'username': username,
                    'password': password
                }, namespace='/admin-ws')

            except Exception as e:
                self.root.after(0, lambda: self.handle_connect_error(str(e)))

        threading.Thread(target=connect_thread, daemon=True).start()

    def handle_connect_error(self, error):
        self.login_btn.config(state='normal')
        self.login_status.config(text=f"連接失敗: {error}", style='Error.TLabel')

    def handle_login_response(self, data):
        if data.get('success'):
            self.authenticated = True
            self.token = data.get('data', {}).get('token')
            self.show_dashboard()
        else:
            self.login_btn.config(state='normal')
            self.login_status.config(text=data.get('error', '登入失敗'), style='Error.TLabel')

    def handle_auth_response(self, data):
        if data.get('success'):
            self.authenticated = True
        else:
            self.authenticated = False
            self.show_login()

    def handle_data_response(self, data_type, data):
        if hasattr(self, f'_pending_{data_type}_callback'):
            callback = getattr(self, f'_pending_{data_type}_callback')
            callback(data)
            delattr(self, f'_pending_{data_type}_callback')

    def handle_user_update_response(self, data):
        if data.get('success'):
            messagebox.showinfo("成功", "用戶狀態已更新")
            self.show_users()
        else:
            messagebox.showerror("錯誤", data.get('error', '操作失敗'))

    def show_dashboard(self):
        for widget in self.root.winfo_children():
            widget.destroy()

        self.main_frame = ttk.Frame(self.root)
        self.main_frame.pack(fill='both', expand=True)

        # 側邊欄
        sidebar = ttk.Frame(self.main_frame, width=180)
        sidebar.pack(side='left', fill='y')
        sidebar.pack_propagate(False)

        ttk.Label(sidebar, text="AIFX Admin", style='Title.TLabel').pack(pady=20)

        # 連線狀態
        self.connection_label = ttk.Label(sidebar, text="● 已連接", style='Connected.TLabel')
        self.connection_label.pack(pady=(0, 15))

        menu_items = [
            ("📊 總覽", self.show_overview),
            ("👥 用戶管理", self.show_users),
            ("📈 訊號管理", self.show_signals),
            ("🤖 ML 模型", self.show_ml),
            ("🔄 重新整理", self.refresh_current),
            ("🚪 登出", self.logout),
        ]

        for text, command in menu_items:
            btn = ttk.Button(sidebar, text=text, command=command, width=18)
            btn.pack(pady=5, padx=10)

        # 內容區域
        self.content_frame = ttk.Frame(self.main_frame)
        self.content_frame.pack(side='right', fill='both', expand=True, padx=10, pady=10)

        self.current_view = 'overview'
        self.show_overview()

    def clear_content(self):
        for widget in self.content_frame.winfo_children():
            widget.destroy()

    def refresh_current(self):
        views = {
            'overview': self.show_overview,
            'users': self.show_users,
            'signals': self.show_signals,
            'ml': self.show_ml,
        }
        if self.current_view in views:
            views[self.current_view]()

    def show_overview(self):
        self.current_view = 'overview'
        self.clear_content()

        ttk.Label(self.content_frame, text="系統總覽", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        loading_label = ttk.Label(self.content_frame, text="載入中...")
        loading_label.pack()

        # 儲存 UI 元素引用
        self._overview_frame = self.content_frame
        self._overview_loading = loading_label

        # 請求資料
        def on_health(data):
            self._health_data = data
            self._check_overview_complete()

        def on_stats(data):
            self._stats_data = data
            self._check_overview_complete()

        self._pending_health_callback = on_health
        self._pending_stats_callback = on_stats
        self._health_data = None
        self._stats_data = None

        self.sio.emit('admin:health', {}, namespace='/admin-ws')
        self.sio.emit('admin:stats', {}, namespace='/admin-ws')

    def _check_overview_complete(self):
        if self._health_data is None or self._stats_data is None:
            return

        if hasattr(self, '_overview_loading'):
            self._overview_loading.destroy()

        health = self._health_data
        stats = self._stats_data

        if not health.get('success') or not stats.get('success'):
            ttk.Label(self._overview_frame, text="無法取得資料", style='Error.TLabel').pack()
            return

        # 統計卡片
        stats_frame = ttk.Frame(self._overview_frame)
        stats_frame.pack(fill='x', pady=10)

        stats_data = stats.get('data') or {}
        users = stats_data.get('users') or {}
        signals = stats_data.get('signals') or {}
        models = stats_data.get('models') or {}

        cards = [
            ("總用戶數", users.get('total', 0), f"+{users.get('newToday', 0)} 今日"),
            ("活躍用戶", users.get('active', 0), ""),
            ("今日訊號", signals.get('today', 0), f"總計: {signals.get('total', 0)}"),
            ("ML 模型", models.get('active', 0), "運行中"),
        ]

        for i, (title, value, subtitle) in enumerate(cards):
            card = ttk.LabelFrame(stats_frame, text=title, padding=15)
            card.grid(row=0, column=i, padx=10, pady=5, sticky='nsew')
            stats_frame.columnconfigure(i, weight=1)
            ttk.Label(card, text=str(value), font=('Arial', 24, 'bold')).pack()
            if subtitle:
                ttk.Label(card, text=subtitle, style='Status.TLabel').pack()

        # 系統狀態
        ttk.Label(self._overview_frame, text="服務狀態", style='Header.TLabel').pack(anchor='w', pady=(20, 10))

        health_data = health.get('data') or {}
        services = health_data.get('services') or {}

        services_frame = ttk.Frame(self._overview_frame)
        services_frame.pack(fill='x')

        service_names = {
            'postgres': 'PostgreSQL',
            'redis': 'Redis',
            'mlEngine': 'ML Engine',
        }

        for name, display_name in service_names.items():
            status = services.get(name, 'unknown')
            status_text = "✅ 連接" if status == 'connected' else "❌ 斷開" if status == 'disconnected' else "⚠️ 未知"
            row = ttk.Frame(services_frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=display_name, width=15).pack(side='left')
            ttk.Label(row, text=status_text).pack(side='left')

        # 系統資訊
        ttk.Label(self._overview_frame, text="系統資訊", style='Header.TLabel').pack(anchor='w', pady=(20, 10))

        info_frame = ttk.Frame(self._overview_frame)
        info_frame.pack(fill='x')

        uptime = health_data.get('uptime', 0)
        uptime_str = f"{int(uptime // 3600)}小時 {int((uptime % 3600) // 60)}分"
        memory = health_data.get('memory', 0)
        memory_str = f"{memory // (1024*1024)} MB"

        infos = [
            ("運行時間", uptime_str),
            ("記憶體使用", memory_str),
            ("版本", health_data.get('version', 'N/A')),
        ]

        for label, value in infos:
            row = ttk.Frame(info_frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=label, width=15).pack(side='left')
            ttk.Label(row, text=value).pack(side='left')

    def show_users(self):
        self.current_view = 'users'
        self.clear_content()

        ttk.Label(self.content_frame, text="用戶管理", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        loading_label = ttk.Label(self.content_frame, text="載入中...")
        loading_label.pack()

        self._users_frame = self.content_frame
        self._users_loading = loading_label

        def on_users(data):
            if hasattr(self, '_users_loading'):
                self._users_loading.destroy()

            if not data.get('success'):
                ttk.Label(self._users_frame, text=f"錯誤: {data.get('error')}", style='Error.TLabel').pack()
                return

            result = data.get('data') or {}
            users = result.get('users') or []
            total = result.get('total', 0)

            ttk.Label(self._users_frame, text=f"共 {total} 位用戶").pack(anchor='w', pady=(0, 10))

            tree_frame = ttk.Frame(self._users_frame)
            tree_frame.pack(fill='both', expand=True)

            columns = ('id', 'username', 'email', 'status', 'created')
            tree = ttk.Treeview(tree_frame, columns=columns, show='headings', height=15)

            tree.heading('id', text='ID')
            tree.heading('username', text='用戶名')
            tree.heading('email', text='Email')
            tree.heading('status', text='狀態')
            tree.heading('created', text='註冊時間')

            tree.column('id', width=50)
            tree.column('username', width=120)
            tree.column('email', width=200)
            tree.column('status', width=80)
            tree.column('created', width=150)

            for user in users:
                status = "✅ 啟用" if user.get('isActive') else "❌ 停用"
                created = str(user.get('createdAt', ''))[:10] if user.get('createdAt') else ''
                tree.insert('', 'end', values=(
                    user.get('id'),
                    user.get('username'),
                    user.get('email'),
                    status,
                    created
                ), tags=(str(user.get('id')), str(user.get('isActive'))))

            scrollbar = ttk.Scrollbar(tree_frame, orient='vertical', command=tree.yview)
            tree.configure(yscrollcommand=scrollbar.set)
            tree.pack(side='left', fill='both', expand=True)
            scrollbar.pack(side='right', fill='y')

            btn_frame = ttk.Frame(self._users_frame)
            btn_frame.pack(fill='x', pady=10)

            def toggle_user():
                selected = tree.selection()
                if not selected:
                    messagebox.showwarning("提示", "請先選擇用戶")
                    return

                item = tree.item(selected[0])
                user_id = item['values'][0]
                is_active = item['tags'][1] == 'True'

                action = "停用" if is_active else "啟用"
                if messagebox.askyesno("確認", f"確定要{action}此用戶嗎？"):
                    self.sio.emit('admin:user:update', {
                        'id': user_id,
                        'isActive': not is_active
                    }, namespace='/admin-ws')

            ttk.Button(btn_frame, text="啟用/停用用戶", command=toggle_user).pack(side='left', padx=5)

        self._pending_users_callback = on_users
        self.sio.emit('admin:users', {'limit': 50}, namespace='/admin-ws')

    def show_signals(self):
        self.current_view = 'signals'
        self.clear_content()

        ttk.Label(self.content_frame, text="訊號管理", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        loading_label = ttk.Label(self.content_frame, text="載入中...")
        loading_label.pack()

        self._signals_frame = self.content_frame
        self._signals_loading = loading_label

        def on_signals(data):
            if hasattr(self, '_signals_loading'):
                self._signals_loading.destroy()

            if not data.get('success'):
                ttk.Label(self._signals_frame, text=f"錯誤: {data.get('error')}", style='Error.TLabel').pack()
                return

            result = data.get('data') or {}
            signals = result.get('signals') or []
            total = result.get('total', 0)

            ttk.Label(self._signals_frame, text=f"共 {total} 個訊號").pack(anchor='w', pady=(0, 10))

            tree_frame = ttk.Frame(self._signals_frame)
            tree_frame.pack(fill='both', expand=True)

            columns = ('id', 'pair', 'direction', 'confidence', 'entry', 'sl', 'tp', 'created')
            tree = ttk.Treeview(tree_frame, columns=columns, show='headings', height=15)

            tree.heading('id', text='ID')
            tree.heading('pair', text='貨幣對')
            tree.heading('direction', text='方向')
            tree.heading('confidence', text='信心度')
            tree.heading('entry', text='入場價')
            tree.heading('sl', text='止損')
            tree.heading('tp', text='止盈')
            tree.heading('created', text='時間')

            tree.column('id', width=50)
            tree.column('pair', width=80)
            tree.column('direction', width=60)
            tree.column('confidence', width=70)
            tree.column('entry', width=80)
            tree.column('sl', width=80)
            tree.column('tp', width=80)
            tree.column('created', width=130)

            for signal in signals:
                direction = "🟢 買入" if signal.get('direction') == 'buy' else "🔴 賣出"
                conf = signal.get('confidence', 0)
                confidence = f"{float(conf) * 100:.1f}%" if conf else 'N/A'
                created = str(signal.get('createdAt', ''))[:19].replace('T', ' ') if signal.get('createdAt') else ''

                tree.insert('', 'end', values=(
                    signal.get('id'),
                    signal.get('pair'),
                    direction,
                    confidence,
                    signal.get('entryPrice', 'N/A'),
                    signal.get('stopLoss', 'N/A'),
                    signal.get('takeProfit', 'N/A'),
                    created
                ))

            scrollbar = ttk.Scrollbar(tree_frame, orient='vertical', command=tree.yview)
            tree.configure(yscrollcommand=scrollbar.set)
            tree.pack(side='left', fill='both', expand=True)
            scrollbar.pack(side='right', fill='y')

        self._pending_signals_callback = on_signals
        self.sio.emit('admin:signals', {'limit': 50}, namespace='/admin-ws')

    def show_ml(self):
        self.current_view = 'ml'
        self.clear_content()

        ttk.Label(self.content_frame, text="ML 模型管理", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        loading_label = ttk.Label(self.content_frame, text="載入中...")
        loading_label.pack()

        self._ml_frame = self.content_frame
        self._ml_loading = loading_label

        def on_ml_status(data):
            self._ml_status_data = data
            self._check_ml_complete()

        def on_ml_models(data):
            self._ml_models_data = data
            self._check_ml_complete()

        self._pending_ml_status_callback = on_ml_status
        self._pending_ml_models_callback = on_ml_models
        self._ml_status_data = None
        self._ml_models_data = None

        self.sio.emit('admin:ml:status', {}, namespace='/admin-ws')
        self.sio.emit('admin:ml:models', {}, namespace='/admin-ws')

    def _check_ml_complete(self):
        if self._ml_status_data is None or self._ml_models_data is None:
            return

        if hasattr(self, '_ml_loading'):
            self._ml_loading.destroy()

        # ML Engine 狀態
        ttk.Label(self._ml_frame, text="ML Engine 狀態", style='Header.TLabel').pack(anchor='w', pady=(0, 10))

        status_data = (self._ml_status_data.get('data') or {})
        status = status_data.get('status', 'unknown')
        status_text = "✅ 運行中" if status == 'running' else "❌ 未連接"

        status_frame = ttk.Frame(self._ml_frame)
        status_frame.pack(fill='x', pady=(0, 20))
        ttk.Label(status_frame, text=f"狀態: {status_text}").pack(anchor='w')

        # 模型列表
        ttk.Label(self._ml_frame, text="模型列表", style='Header.TLabel').pack(anchor='w', pady=(0, 10))

        models_data = self._ml_models_data.get('data') or {}
        models = models_data.get('models') or []

        tree_frame = ttk.Frame(self._ml_frame)
        tree_frame.pack(fill='both', expand=True)

        columns = ('name', 'type', 'version', 'accuracy', 'status')
        tree = ttk.Treeview(tree_frame, columns=columns, show='headings', height=10)

        tree.heading('name', text='名稱')
        tree.heading('type', text='類型')
        tree.heading('version', text='版本')
        tree.heading('accuracy', text='準確率')
        tree.heading('status', text='狀態')

        for model in models:
            acc = model.get('accuracy', 0)
            accuracy = f"{float(acc) * 100:.1f}%" if acc else 'N/A'
            status = "✅ 運行" if model.get('status') == 'active' else "⏸ 停止"

            tree.insert('', 'end', values=(
                model.get('name'),
                model.get('type'),
                model.get('version'),
                accuracy,
                status
            ))

        tree.pack(fill='both', expand=True)

    def logout(self):
        if messagebox.askyesno("確認", "確定要登出嗎？"):
            if self.sio.connected:
                self.sio.disconnect()
            self.authenticated = False
            self.token = None
            self.show_login()

    def on_closing(self):
        if self.sio.connected:
            self.sio.disconnect()
        self.root.destroy()


def main():
    root = tk.Tk()
    app = AIFXAdminWSApp(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()


if __name__ == "__main__":
    main()
