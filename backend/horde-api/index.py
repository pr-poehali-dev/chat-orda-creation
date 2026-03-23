"""API альянса ОРДА — управление участниками, сообщениями, правилами и событиями."""
import json
import os
import psycopg2

SCHEMA = "t_p39730427_chat_orda_creation"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    resource = qs.get("resource", "")
    rid_str = qs.get("id", "")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ---- MEMBERS ----
        if resource == "members":
            if method == "GET":
                cur.execute(f"SELECT id, nick, rank, joined_at, is_online FROM {SCHEMA}.members ORDER BY id")
                rows = cur.fetchall()
                return ok([{"id": r[0], "nick": r[1], "rank": r[2], "joinedAt": r[3].strftime("%d.%m.%Y"), "isOnline": r[4]} for r in rows])

            if method == "POST":
                nick = (body.get("nick") or "").strip()
                if not nick or len(nick) < 2:
                    return err("Ник слишком короткий")
                cur.execute(f"SELECT id FROM {SCHEMA}.members WHERE LOWER(nick)=LOWER(%s)", (nick,))
                if cur.fetchone():
                    return err("Этот ник уже занят")
                cur.execute(
                    f"INSERT INTO {SCHEMA}.members (nick, rank, is_online) VALUES (%s, 'Новобранец', TRUE) RETURNING id, nick, rank, joined_at, is_online",
                    (nick,)
                )
                r = cur.fetchone()
                conn.commit()
                cur.execute(
                    f"INSERT INTO {SCHEMA}.messages (author, rank, text, is_system) VALUES ('СИСТЕМА', '', %s, TRUE)",
                    (f"{nick} вступил в Орду! Добро пожаловать, воин! ⚔️",)
                )
                conn.commit()
                return ok({"id": r[0], "nick": r[1], "rank": r[2], "joinedAt": r[3].strftime("%d.%m.%Y"), "isOnline": r[4]})

            if method == "PUT" and rid_str:
                mid = int(rid_str)
                if body.get("rank"):
                    cur.execute(f"UPDATE {SCHEMA}.members SET rank=%s WHERE id=%s", (body["rank"], mid))
                if body.get("nick"):
                    cur.execute(f"UPDATE {SCHEMA}.members SET nick=%s WHERE id=%s", (body["nick"].strip(), mid))
                conn.commit()
                cur.execute(f"SELECT id, nick, rank, joined_at, is_online FROM {SCHEMA}.members WHERE id=%s", (mid,))
                r = cur.fetchone()
                return ok({"id": r[0], "nick": r[1], "rank": r[2], "joinedAt": r[3].strftime("%d.%m.%Y"), "isOnline": r[4]})

            if method == "DELETE" and rid_str:
                cur.execute(f"DELETE FROM {SCHEMA}.members WHERE id=%s", (int(rid_str),))
                conn.commit()
                return ok({"deleted": int(rid_str)})

        # ---- MESSAGES ----
        if resource == "messages":
            if method == "GET":
                cur.execute(f"SELECT id, author, rank, text, is_system, created_at FROM {SCHEMA}.messages ORDER BY id DESC LIMIT 100")
                rows = cur.fetchall()
                return ok([{"id": r[0], "author": r[1], "rank": r[2], "text": r[3], "isSystem": r[4], "time": r[5].strftime("%H:%M")} for r in reversed(rows)])

            if method == "POST":
                author = (body.get("author") or "").strip()
                rank = (body.get("rank") or "").strip()
                text = (body.get("text") or "").strip()
                if not author or not text:
                    return err("author и text обязательны")
                cur.execute(
                    f"INSERT INTO {SCHEMA}.messages (author, rank, text, is_system) VALUES (%s, %s, %s, FALSE) RETURNING id, created_at",
                    (author, rank, text)
                )
                r = cur.fetchone()
                conn.commit()
                return ok({"id": r[0], "author": author, "rank": rank, "text": text, "isSystem": False, "time": r[1].strftime("%H:%M")})

            if method == "DELETE" and rid_str:
                cur.execute(f"DELETE FROM {SCHEMA}.messages WHERE id=%s", (int(rid_str),))
                conn.commit()
                return ok({"deleted": int(rid_str)})

        # ---- RULES ----
        if resource == "rules":
            if method == "GET":
                cur.execute(f"SELECT id, text, sort_order FROM {SCHEMA}.rules ORDER BY sort_order, id")
                rows = cur.fetchall()
                return ok([{"id": r[0], "text": r[1]} for r in rows])

            if method == "POST":
                text = (body.get("text") or "").strip()
                if not text:
                    return err("text обязателен")
                cur.execute(f"SELECT COALESCE(MAX(sort_order),0)+1 FROM {SCHEMA}.rules")
                order = cur.fetchone()[0]
                cur.execute(f"INSERT INTO {SCHEMA}.rules (text, sort_order) VALUES (%s, %s) RETURNING id", (text, order))
                rid = cur.fetchone()[0]
                conn.commit()
                return ok({"id": rid, "text": text})

            if method == "PUT" and rid_str:
                text = (body.get("text") or "").strip()
                if text:
                    cur.execute(f"UPDATE {SCHEMA}.rules SET text=%s WHERE id=%s", (text, int(rid_str)))
                    conn.commit()
                return ok({"id": int(rid_str), "text": text})

            if method == "DELETE" and rid_str:
                cur.execute(f"DELETE FROM {SCHEMA}.rules WHERE id=%s", (int(rid_str),))
                conn.commit()
                return ok({"deleted": int(rid_str)})

        # ---- EVENTS ----
        if resource == "events":
            if method == "GET":
                cur.execute(f"SELECT id, title, event_date, description FROM {SCHEMA}.events ORDER BY id")
                rows = cur.fetchall()
                return ok([{"id": r[0], "title": r[1], "date": r[2], "desc": r[3]} for r in rows])

            if method == "POST":
                title = (body.get("title") or "").strip()
                date = (body.get("date") or "").strip()
                desc = (body.get("desc") or "").strip()
                if not title or not date:
                    return err("title и date обязательны")
                cur.execute(
                    f"INSERT INTO {SCHEMA}.events (title, event_date, description) VALUES (%s, %s, %s) RETURNING id",
                    (title, date, desc)
                )
                eid = cur.fetchone()[0]
                conn.commit()
                return ok({"id": eid, "title": title, "date": date, "desc": desc})

            if method == "DELETE" and rid_str:
                cur.execute(f"DELETE FROM {SCHEMA}.events WHERE id=%s", (int(rid_str),))
                conn.commit()
                return ok({"deleted": int(rid_str)})

        return ok({"status": "ok"})

    finally:
        cur.close()
        conn.close()