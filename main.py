# -*- coding: utf-8 -*-
"""
Deutsch Quest — точка входа.

    python main.py          → веб-версия на локальном хосте (http://127.0.0.1:8000)
    python main.py --port 9000 --no-browser

Приложение целиком живёт в браузере (HTML/CSS/JS в web/),
сервер только отдаёт статические файлы, словари и сохраняет прогресс.
Прежнее окно Tkinter по-прежнему доступно флагом --desktop.
"""
import argparse
import logging


def main():
    parser = argparse.ArgumentParser(description="Deutsch Quest — тренажёр немецкого")
    parser.add_argument("--port", type=int, default=8000, help="порт локального сервера")
    parser.add_argument("--no-browser", action="store_true",
                        help="не открывать браузер автоматически")
    parser.add_argument("--desktop", action="store_true",
                        help="старое окно Tkinter (dq/app.py) вместо веб-версии")
    parser.add_argument("--prefetch-images", action="store_true",
                        help="сгенерировать картинки для всех слов и выйти")
    parser.add_argument("--online-images", action="store_true",
                        help="при предзагрузке картинок искать их в интернете")
    parser.add_argument("--prefetch-audio", action="store_true",
                        help="скачать озвучку для всех слов и выйти")
    parser.add_argument("--limit", type=int, default=None,
                        help="ограничить количество слов при предзагрузке картинок")
    parser.add_argument("--verbose", action="store_true", help="подробный лог")
    parser.add_argument("--host", default="0.0.0.0", help="адрес привязки (0.0.0.0 — для всех)")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.prefetch_images or args.prefetch_audio:
        _run_prefetch(args)
        return

    if args.desktop:
        _run_desktop()
        return

    from server import serve
    serve(args.port, open_browser=not args.no_browser, host=args.host)


def _run_desktop():
    """Старый интерфейс Tkinter (оставлен как резервный вариант)."""
    import tkinter as tk
    from dq.core import set_dpi_awareness
    from dq.app import GermanQuestApp

    set_dpi_awareness()
    root = tk.Tk()
    GermanQuestApp(root)
    root.mainloop()


def _run_prefetch(args):
    """Фоновая подготовка медиа без запуска интерфейса (удобно запустить один раз)."""
    from dq.core import load_words_with_groups, load_data_from_file, WORDS_FILE, PHRASES_FILE
    from dq.media import ImageStore, ensure_audio_cached_parallel

    grouped = load_words_with_groups(WORDS_FILE)
    pairs = [(de, ru) for arr in grouped.values() for de, ru in arr]
    pairs += load_data_from_file(PHRASES_FILE)
    print(f"Слов всего: {len(pairs)}")

    if args.prefetch_audio:
        items = [(de, "de") for de, _ in pairs]
        items += [(ru, "ru") for _, ru in pairs]
        print(f"Озвучка: {len(items)} файлов…")
        ensure_audio_cached_parallel(
            items,
            progress_callback=lambda d, t: print(f"  аудио {d}/{t}", end="\r"),
            max_workers=6,
        )
        print("\nОзвучка готова.")

    if args.prefetch_images:
        store = ImageStore()
        if args.online_images:
            print("Картинки: ищем в интернете (Wikipedia/Commons/Openverse)…")
            for de, _ru in pairs:
                if not store.find_file(de):
                    store.fetch_online(de)
            print("\nОнлайн-поиск завершён. Файлы в images/")
            return
        print("Картинки: генерируем простые ассоциации локально (быстро, без сети)…")
        done = store.prefetch(
            pairs, limit=args.limit,
            progress=lambda d, t: print(f"  картинка {d}/{t}", end="\r"),
        )
        print(f"\nГотово. Обработано новых слов: {done}. Файлы в images/")


if __name__ == "__main__":
    main()
