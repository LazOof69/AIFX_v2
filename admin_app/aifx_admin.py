#!/usr/bin/env python3
"""
AIFX Admin Dashboard - Desktop Application
用於管理 AIFX 交易系統的桌面應用程式
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import requests
import json
from datetime import datetime
import threading

class AIFXAdminApp:
    def __init__(self, root):
        self.root = root
        self.root.title("AIFX Admin Dashboard")
        self.root.geometry("900x650")
        self.root.minsize(800, 600)

        # API 設定
        self.api_url = ""
        self.token = None

        # 設定樣式
        self.setup_styles()

        # 顯示登入畫面
        self.show_login()

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')

        # 自定義樣式
        style.configure('Title.TLabel', font=('Arial', 18, 'bold'))
        style.configure('Header.TLabel', font=('Arial', 12, 'bold'))
        style.configure('Status.TLabel', font=('Arial', 10))
        style.configure('Success.TLabel', foreground='green')
        style.configure('Error.TLabel', foreground='red')
        style.configure('Warning.TLabel', foreground='orange')

    def show_login(self):
        """顯示登入畫面"""
        # 清除現有內容
        for widget in self.root.winfo_children():
            widget.destroy()

        # 主框架
        main_frame = ttk.Frame(self.root, padding=40)
        main_frame.place(relx=0.5, rely=0.5, anchor='center')

        # 標題
        ttk.Label(main_frame, text="AIFX Admin", style='Title.TLabel').pack(pady=(0, 30))

        # API URL
        ttk.Label(main_frame, text="伺服器網址:").pack(anchor='w')
        self.url_entry = ttk.Entry(main_frame, width=45)
        self.url_entry.insert(0, "https://heating-things-dsl-placing.trycloudflare.com")
        self.url_entry.pack(pady=(5, 15))

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
        self.login_btn = ttk.Button(main_frame, text="登入", command=self.login)
        self.login_btn.pack(pady=10, ipadx=20, ipady=5)

        # 狀態標籤
        self.login_status = ttk.Label(main_frame, text="")
        self.login_status.pack(pady=10)

        # 綁定 Enter 鍵
        self.password_entry.bind('<Return>', lambda e: self.login())

    def login(self):
        """登入"""
        self.api_url = self.url_entry.get().rstrip('/')
        username = self.username_entry.get()
        password = self.password_entry.get()

        if not all([self.api_url, username, password]):
            self.login_status.config(text="請填寫所有欄位", style='Error.TLabel')
            return

        self.login_btn.config(state='disabled')
        self.login_status.config(text="登入中...", style='Status.TLabel')
        self.root.update()

        try:
            response = requests.post(
                f"{self.api_url}/api/v1/admin/login",
                json={"username": username, "password": password},
                timeout=10
            )
            data = response.json()

            if data.get('success') and data.get('data', {}).get('token'):
                self.token = data['data']['token']
                self.show_dashboard()
            else:
                self.login_status.config(text=data.get('error', '登入失敗'), style='Error.TLabel')
                self.login_btn.config(state='normal')
        except requests.exceptions.Timeout:
            self.login_status.config(text="連線逾時，請檢查網址", style='Error.TLabel')
            self.login_btn.config(state='normal')
        except requests.exceptions.ConnectionError:
            self.login_status.config(text="無法連接伺服器", style='Error.TLabel')
            self.login_btn.config(state='normal')
        except Exception as e:
            self.login_status.config(text=f"錯誤: {str(e)}", style='Error.TLabel')
            self.login_btn.config(state='normal')

    def api_request(self, method, endpoint, **kwargs):
        """發送 API 請求"""
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f'Bearer {self.token}'

        try:
            response = requests.request(
                method,
                f"{self.api_url}/api/v1{endpoint}",
                headers=headers,
                timeout=10,
                **kwargs
            )
            return response.json()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def show_dashboard(self):
        """顯示主控台"""
        # 清除現有內容
        for widget in self.root.winfo_children():
            widget.destroy()

        # 建立主框架
        self.main_frame = ttk.Frame(self.root)
        self.main_frame.pack(fill='both', expand=True)

        # 側邊欄
        sidebar = ttk.Frame(self.main_frame, width=180)
        sidebar.pack(side='left', fill='y')
        sidebar.pack_propagate(False)

        # Logo
        ttk.Label(sidebar, text="AIFX Admin", style='Title.TLabel').pack(pady=20)

        # 選單按鈕
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

        # 顯示總覽
        self.current_view = 'overview'
        self.show_overview()

    def clear_content(self):
        """清除內容區域"""
        for widget in self.content_frame.winfo_children():
            widget.destroy()

    def refresh_current(self):
        """重新整理當前頁面"""
        views = {
            'overview': self.show_overview,
            'users': self.show_users,
            'signals': self.show_signals,
            'ml': self.show_ml,
        }
        if self.current_view in views:
            views[self.current_view]()

    def show_overview(self):
        """顯示總覽"""
        self.current_view = 'overview'
        self.clear_content()

        ttk.Label(self.content_frame, text="系統總覽", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        # 載入中
        loading_label = ttk.Label(self.content_frame, text="載入中...")
        loading_label.pack()
        self.root.update()

        # 取得資料
        health = self.api_request('GET', '/admin/health')
        stats = self.api_request('GET', '/admin/stats')

        loading_label.destroy()

        # 檢查 API 錯誤
        if not health.get('success') or not stats.get('success'):
            error_msg = health.get('error') or stats.get('error') or '無法取得資料'
            ttk.Label(self.content_frame, text=f"錯誤: {error_msg}", style='Error.TLabel').pack(pady=20)
            return

        # 統計卡片框架
        stats_frame = ttk.Frame(self.content_frame)
        stats_frame.pack(fill='x', pady=10)

        # 統計數據
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
        ttk.Label(self.content_frame, text="服務狀態", style='Header.TLabel').pack(anchor='w', pady=(20, 10))

        health_data = health.get('data') or {}
        services = health_data.get('services') or {}

        services_frame = ttk.Frame(self.content_frame)
        services_frame.pack(fill='x')

        service_names = {
            'postgres': 'PostgreSQL',
            'redis': 'Redis',
            'mlEngine': 'ML Engine',
            'backend': 'Backend',
        }

        for name, display_name in service_names.items():
            status = services.get(name, 'unknown')
            status_text = "✅ 連接" if status == 'connected' else "❌ 斷開" if status == 'disconnected' else "⚠️ 未知"

            row = ttk.Frame(services_frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=display_name, width=15).pack(side='left')
            ttk.Label(row, text=status_text).pack(side='left')

        # 系統資訊
        ttk.Label(self.content_frame, text="系統資訊", style='Header.TLabel').pack(anchor='w', pady=(20, 10))

        info_frame = ttk.Frame(self.content_frame)
        info_frame.pack(fill='x')

        uptime = health_data.get('uptime', 0)
        uptime_str = f"{int(uptime // 3600)}小時 {int((uptime % 3600) // 60)}分"
        memory = health_data.get('memory', 0)
        memory_str = f"{memory // (1024*1024)} MB"

        infos = [
            ("運行時間", uptime_str),
            ("記憶體使用", memory_str),
            ("版本", health_data.get('version', 'N/A')),
            ("環境", health_data.get('environment', 'N/A')),
        ]

        for label, value in infos:
            row = ttk.Frame(info_frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=label, width=15).pack(side='left')
            ttk.Label(row, text=value).pack(side='left')

    def show_users(self):
        """顯示用戶管理"""
        self.current_view = 'users'
        self.clear_content()

        ttk.Label(self.content_frame, text="用戶管理", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        # 載入中
        loading_label = ttk.Label(self.content_frame, text="載入中...")
        loading_label.pack()
        self.root.update()

        # 取得資料
        result = self.api_request('GET', '/admin/users', params={'limit': 50})
        loading_label.destroy()

        if not result.get('success'):
            ttk.Label(self.content_frame, text=f"錯誤: {result.get('error')}", style='Error.TLabel').pack()
            return

        data = result.get('data') or {}
        users = data.get('users') or []
        total = data.get('total', 0)

        ttk.Label(self.content_frame, text=f"共 {total} 位用戶").pack(anchor='w', pady=(0, 10))

        # 用戶列表
        tree_frame = ttk.Frame(self.content_frame)
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
            created = user.get('createdAt', '')[:10] if user.get('createdAt') else ''
            tree.insert('', 'end', values=(
                user.get('id'),
                user.get('username'),
                user.get('email'),
                status,
                created
            ), tags=(str(user.get('id')), str(user.get('isActive'))))

        # 滾動條
        scrollbar = ttk.Scrollbar(tree_frame, orient='vertical', command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)

        tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')

        # 操作按鈕
        btn_frame = ttk.Frame(self.content_frame)
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
                result = self.api_request('PUT', f'/admin/users/{user_id}', json={'isActive': not is_active})
                if result.get('success'):
                    messagebox.showinfo("成功", f"用戶已{action}")
                    self.show_users()
                else:
                    messagebox.showerror("錯誤", result.get('error', '操作失敗'))

        ttk.Button(btn_frame, text="啟用/停用用戶", command=toggle_user).pack(side='left', padx=5)

    def show_signals(self):
        """顯示訊號管理"""
        self.current_view = 'signals'
        self.clear_content()

        ttk.Label(self.content_frame, text="訊號管理", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        # 載入中
        loading_label = ttk.Label(self.content_frame, text="載入中...")
        loading_label.pack()
        self.root.update()

        # 取得資料
        result = self.api_request('GET', '/admin/signals', params={'limit': 50})
        loading_label.destroy()

        if not result.get('success'):
            ttk.Label(self.content_frame, text=f"錯誤: {result.get('error')}", style='Error.TLabel').pack()
            return

        data = result.get('data') or {}
        signals = data.get('signals') or []
        total = data.get('total', 0)

        ttk.Label(self.content_frame, text=f"共 {total} 個訊號").pack(anchor='w', pady=(0, 10))

        # 訊號列表
        tree_frame = ttk.Frame(self.content_frame)
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
            confidence = f"{float(signal.get('confidence', 0)) * 100:.1f}%"
            created = signal.get('createdAt', '')[:19].replace('T', ' ') if signal.get('createdAt') else ''

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

        # 滾動條
        scrollbar = ttk.Scrollbar(tree_frame, orient='vertical', command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)

        tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')

    def show_ml(self):
        """顯示 ML 模型"""
        self.current_view = 'ml'
        self.clear_content()

        ttk.Label(self.content_frame, text="ML 模型管理", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        # 載入中
        loading_label = ttk.Label(self.content_frame, text="載入中...")
        loading_label.pack()
        self.root.update()

        # 取得資料
        models_result = self.api_request('GET', '/admin/ml/models')
        status_result = self.api_request('GET', '/admin/ml/status')
        loading_label.destroy()

        # ML Engine 狀態
        ttk.Label(self.content_frame, text="ML Engine 狀態", style='Header.TLabel').pack(anchor='w', pady=(0, 10))

        status_data = status_result.get('data') or {}
        status = status_data.get('status', 'unknown')
        status_text = "✅ 運行中" if status == 'running' else "❌ 未連接"

        status_frame = ttk.Frame(self.content_frame)
        status_frame.pack(fill='x', pady=(0, 20))

        ttk.Label(status_frame, text=f"狀態: {status_text}").pack(anchor='w')
        if status_data.get('uptime'):
            ttk.Label(status_frame, text=f"運行時間: {status_data.get('uptime')}").pack(anchor='w')
        if status_data.get('memory'):
            ttk.Label(status_frame, text=f"記憶體: {status_data.get('memory')}").pack(anchor='w')

        # 模型列表
        ttk.Label(self.content_frame, text="模型列表", style='Header.TLabel').pack(anchor='w', pady=(0, 10))

        models_data = models_result.get('data') or {}
        models = models_data.get('models') or []

        tree_frame = ttk.Frame(self.content_frame)
        tree_frame.pack(fill='both', expand=True)

        columns = ('name', 'type', 'version', 'accuracy', 'status', 'last_trained')
        tree = ttk.Treeview(tree_frame, columns=columns, show='headings', height=10)

        tree.heading('name', text='名稱')
        tree.heading('type', text='類型')
        tree.heading('version', text='版本')
        tree.heading('accuracy', text='準確率')
        tree.heading('status', text='狀態')
        tree.heading('last_trained', text='最後訓練')

        for model in models:
            accuracy = f"{float(model.get('accuracy', 0)) * 100:.1f}%" if model.get('accuracy') else 'N/A'
            status = "✅ 運行" if model.get('status') == 'active' else "⏸ 停止"
            last_trained = model.get('lastTrained', 'N/A') or 'N/A'

            tree.insert('', 'end', values=(
                model.get('name'),
                model.get('type'),
                model.get('version'),
                accuracy,
                status,
                last_trained
            ), tags=(str(model.get('id')),))

        tree.pack(fill='both', expand=True)

        # 操作按鈕
        btn_frame = ttk.Frame(self.content_frame)
        btn_frame.pack(fill='x', pady=10)

        def retrain_model():
            selected = tree.selection()
            if not selected:
                messagebox.showwarning("提示", "請先選擇模型")
                return

            model_id = tree.item(selected[0])['tags'][0]
            if messagebox.askyesno("確認", "確定要重新訓練此模型嗎？\n這可能需要幾分鐘時間。"):
                result = self.api_request('POST', f'/admin/ml/retrain/{model_id}')
                if result.get('success'):
                    messagebox.showinfo("成功", "訓練請求已送出")
                else:
                    messagebox.showerror("錯誤", result.get('error', '訓練請求失敗'))

        ttk.Button(btn_frame, text="重新訓練模型", command=retrain_model).pack(side='left', padx=5)

    def logout(self):
        """登出"""
        if messagebox.askyesno("確認", "確定要登出嗎？"):
            self.token = None
            self.show_login()


def main():
    root = tk.Tk()
    app = AIFXAdminApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
