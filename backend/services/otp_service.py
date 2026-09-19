import random
import time
import os
import smtplib
import socket
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import HTTPException
from backend.config import SENDER_EMAIL, SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT

# In-memory store for active OTP codes: { email_lower: { "otp": "1234", "expires_at": timestamp } }
_OTP_CACHE = {}

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

def check_domain_resolves(domain: str) -> bool:
    """Checks if domain or any parent domain (e.g. uiu.ac.bd for bscse.uiu.ac.bd) resolves."""
    try:
        socket.getaddrinfo(domain, None)
        return True
    except socket.gaierror:
        pass
    except Exception:
        return True

    # Traverse subdomains to root university domain
    parts = domain.split(".")
    while len(parts) > 2:
        parts.pop(0)
        parent = ".".join(parts)
        try:
            socket.getaddrinfo(parent, None)
            return True
        except socket.gaierror:
            pass
        except Exception:
            return True

    return False


def validate_email_address(email: str) -> str:
    """Validates email format and verifies destination domain exists in DNS."""
    if not email:
        raise HTTPException(status_code=400, detail="Student email is required. Order was not confirmed.")

    clean = email.strip().lower()
    if not re.match(EMAIL_REGEX, clean):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid email address format '{clean}'. Order was not confirmed. Please enter a valid email."
        )

    domain = clean.split("@")[-1].strip()
    if not domain or "." not in domain or len(domain) < 4:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid email domain in '{clean}'. Order was not confirmed."
        )

    # Check if domain or parent domain exists
    if not check_domain_resolves(domain):
        raise HTTPException(
            status_code=400,
            detail=f"Email domain '@{domain}' not found or does not exist. Order was not confirmed. Please check your email address."
        )

    return clean

def send_email_smtp(to_email: str, otp_code: str):
    """
    Attempt to send an OTP email from ashikhasanhredoy@gmail.com via SMTP if credentials are provided in environment.
    Falls back gracefully to console log if SMTP is not configured.
    """
    smtp_host = SMTP_HOST
    smtp_port = SMTP_PORT
    smtp_user = SMTP_USER or "ashikhasanhredoy@gmail.com"
    smtp_pass = SMTP_PASS

    if not smtp_pass:
        print(f"\n[EMAIL OTP NOTICE] SMTP_PASS not set in environment.")
        print(f"[EMAIL OTP] ══════════════════════════════════════════════════")
        print(f"[EMAIL OTP] From: {SENDER_EMAIL}")
        print(f"[EMAIL OTP] To:   {to_email}")
        print(f"[EMAIL OTP] Code: {otp_code}")
        print(f"[EMAIL OTP] ══════════════════════════════════════════════════\n")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your University Canteen Order Verification OTP: {otp_code}"
        msg["From"] = f"University Canteen <{SENDER_EMAIL}>"
        msg["To"] = to_email

        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #ef4444; margin: 0;">University Canteen</h2>
                <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Food Delivery Verification</p>
            </div>
            <p style="font-size: 15px; color: #374151;">Hello,</p>
            <p style="font-size: 15px; color: #374151;">Use the following 4-digit OTP code to verify your order checkout:</p>
            <div style="text-align: center; margin: 25px 0;">
                <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ef4444; background: #fef2f2; padding: 12px 28px; border-radius: 8px; border: 1px dashed #fca5a5;">
                    {otp_code}
                </span>
            </div>
            <p style="font-size: 13px; color: #6b7280; text-align: center;">This code is valid for 5 minutes. Please do not share it with anyone.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">Thank you for ordering with University Canteen Food Delivery!</p>
        </div>
        """
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=8) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        
        print(f"[EMAIL OTP] Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL OTP ERROR] Failed sending to {to_email}: {e}")
        return False


def send_order_confirmation_email(
    to_email: str,
    student_name: str,
    student_id: str,
    otp_code: str,
    order_items: list,
    total_amount: float,
    delivery_location: str,
    phone: str
) -> bool:
    """
    Sends an Order Confirmation email containing the 4-digit Delivery OTP code and full order receipt.
    """
    smtp_host = SMTP_HOST
    smtp_port = SMTP_PORT
    smtp_user = SMTP_USER or "ashikhasanhredoy@gmail.com"
    smtp_pass = SMTP_PASS

    if not smtp_pass:
        print(f"\n[ORDER CONFIRMATION EMAIL] SMTP_PASS not set in environment.")
        print(f"[ORDER OTP] To: {to_email} | OTP: {otp_code} | Total: ৳{total_amount}\n")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🎉 Order Confirmed! Your Delivery OTP: {otp_code}"
        msg["From"] = f"University Canteen <{SENDER_EMAIL}>"
        msg["To"] = to_email

        # Plain text version for robust fallback
        plain_items = "\n".join([f"  • {item.get('food_name', 'Item')} ({item.get('shop_name', 'Canteen')}) — Qty: {item.get('quantity', 1)} | ৳{item.get('price', 0.0):.2f}" for item in order_items])
        plain_text = f"""
==================================================
        UNIVERSITY CANTEEN FOOD DELIVERY
==================================================

Hello {student_name} (Student ID: {student_id}),

Your order has been confirmed successfully!

YOUR 4-DIGIT DELIVERY OTP:
**************************************************
                    [ {otp_code} ]
**************************************************
(Please provide this 4-digit OTP to the delivery person upon arrival)

ORDER ITEMS LIST:
--------------------------------------------------
{plain_items}
--------------------------------------------------
TOTAL AMOUNT: ৳{total_amount:.2f}

DELIVERY DETAILS:
• Location: {delivery_location}
• Phone:    {phone}

Thank you for ordering with University Canteen!
Sent from {SENDER_EMAIL}
==================================================
"""
        msg.attach(MIMEText(plain_text, "plain"))

        # Build items list HTML
        items_list_html = ""
        for item in order_items:
            f_name = item.get("food_name", "Food Item")
            s_name = item.get("shop_name", "Canteen")
            qty = item.get("quantity", 1)
            prc = item.get("price", 0.0)
            items_list_html += f"""
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; margin-bottom: 8px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #ef4444;">
                <div>
                    <div style="font-weight: 700; color: #111827; font-size: 15px;">{f_name}</div>
                    <div style="font-size: 13px; color: #6b7280;">🏬 {s_name} &nbsp;•&nbsp; <span style="font-weight: 600; color: #374151;">Qty: {qty}</span></div>
                </div>
                <div style="font-weight: 800; color: #111827; font-size: 16px;">
                    ৳{prc:.2f}
                </div>
            </div>
            """

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff; color: #1f2937;">
            <!-- Header -->
            <div style="text-align: center; padding-bottom: 18px; border-bottom: 2px solid #f3f4f6;">
                <h2 style="color: #ef4444; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">University Canteen</h2>
                <div style="color: #10b981; font-size: 15px; font-weight: 700; margin-top: 4px;">🎉 Order Confirmed!</div>
            </div>
            
            <p style="font-size: 15px; margin: 20px 0 6px 0;">Hello <strong>{student_name}</strong> (Student ID: <strong>{student_id}</strong>),</p>
            <p style="font-size: 14px; color: #4b5563; margin-top: 0;">Your food order has been confirmed. Below is your 4-digit Delivery OTP:</p>
            
            <!-- Prominent BOLD 4-digit OTP Box -->
            <div style="text-align: center; margin: 22px 0; background: #fff1f2; border: 2.5px dashed #f43f5e; border-radius: 14px; padding: 20px 16px;">
                <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #be123c; margin-bottom: 8px;">4-DIGIT DELIVERY OTP</div>
                <div style="font-size: 46px; font-weight: 900; letter-spacing: 12px; color: #e11d48; font-family: 'Courier New', Courier, monospace; text-shadow: 1px 1px 0px #ffe4e6;">
                    <strong>{otp_code}</strong>
                </div>
                <div style="font-size: 13px; color: #4b5563; margin-top: 8px; font-weight: 600;">
                    👉 Please provide this <strong>{otp_code}</strong> OTP to the delivery person upon food arrival.
                </div>
            </div>

            <!-- Itemized Order List -->
            <div style="margin-top: 24px;">
                <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; margin-bottom: 10px;">📋 Ordered Items List</div>
                {items_list_html}
            </div>

            <!-- Total Amount Card -->
            <div style="margin-top: 14px; padding: 14px 16px; background: #111827; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; color: #ffffff;">
                <span style="font-size: 16px; font-weight: 600; color: #d1d5db;">Total Order Amount:</span>
                <span style="font-size: 22px; font-weight: 800; color: #34d399;">৳{total_amount:.2f}</span>
            </div>

            <!-- Delivery Info -->
            <div style="background: #f9fafb; border-radius: 10px; padding: 14px; margin-top: 16px; font-size: 13.5px; color: #4b5563;">
                <div style="margin-bottom: 4px;">📍 <strong>Delivery Location:</strong> {delivery_location}</div>
                <div>📞 <strong>Contact Phone:</strong> {phone}</div>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">Thank you for ordering with University Canteen Food Delivery!<br>Delivered from {SENDER_EMAIL}</p>
        </div>
        """
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            refused = server.sendmail(smtp_user, [to_email], msg.as_string())
            if refused and to_email in refused:
                err_code, err_msg = refused[to_email]
                print(f"[ORDER CONFIRMATION EMAIL REFUSED] {to_email}: {err_code} - {err_msg}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Email address not found or rejected ({to_email}). Order was not confirmed. Please check your email."
                )

        print(f"[ORDER CONFIRMATION EMAIL] Sent successfully to {to_email} with OTP {otp_code}")
        return True
    except HTTPException:
        raise
    except smtplib.SMTPRecipientsRefused as e:
        print(f"[SMTP RECIPIENTS REFUSED] {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Email address '{to_email}' not found or invalid. Order was not confirmed. Please check your email."
        )
    except smtplib.SMTPResponseException as e:
        print(f"[SMTP RESPONSE EXCEPTION] {e.smtp_code}: {e.smtp_error}")
        raise HTTPException(
            status_code=400,
            detail=f"Could not deliver email to '{to_email}' (SMTP {e.smtp_code}). Order was not confirmed."
        )
    except Exception as e:
        print(f"[ORDER CONFIRMATION EMAIL ERROR] Failed sending to {to_email}: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to deliver order confirmation to '{to_email}'. Please verify your email address."
        )


def send_order_delivered_email(
    to_email: str,
    student_name: str,
    order_id_display: str,
    items: list,
    total_amount: float,
    delivery_location: str,
    delivery_boy_id: str = None
):
    """
    Sends 'Order Delivered' notification email to the buyer when delivery is confirmed.
    """
    if not to_email or "@" not in to_email:
        return False

    smtp_host = SMTP_HOST
    smtp_port = SMTP_PORT
    smtp_user = SMTP_USER or "ashikhasanhredoy@gmail.com"
    smtp_pass = SMTP_PASS

    if not smtp_pass:
        print(f"[ORDER DELIVERED EMAIL (DEV LOG)] Order #{order_id_display} delivered to {to_email}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🎉 Order Delivered! #{order_id_display} - University Canteen"
        msg["From"] = f"University Canteen <{smtp_user}>"
        msg["To"] = to_email

        items_list_html = ""
        for it in items:
            f_name = it.get("food_name", "Food")
            s_name = it.get("shop_name", "Canteen")
            qty = it.get("quantity", 1)
            prc = it.get("price", 0.0)
            items_list_html += f"""
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; border: 1px solid #e5e7eb;">
                <div>
                    <div style="font-weight: 700; color: #111827; font-size: 14.5px;">{f_name}</div>
                    <div style="font-size: 13px; color: #6b7280;">🏬 {s_name} &nbsp;•&nbsp; <span style="font-weight: 600; color: #374151;">Qty: {qty}</span></div>
                </div>
                <div style="font-weight: 800; color: #111827; font-size: 15px;">
                    ৳{prc:.2f}
                </div>
            </div>
            """

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff; color: #1f2937;">
            <!-- Header -->
            <div style="text-align: center; padding-bottom: 18px; border-bottom: 2px solid #f3f4f6;">
                <h2 style="color: #ef4444; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">University Canteen</h2>
                <div style="color: #059669; font-size: 18px; font-weight: 800; margin-top: 6px;">🎉 Order Delivered!</div>
            </div>
            
            <p style="font-size: 15px; margin: 20px 0 6px 0;">Hello <strong>{student_name}</strong>,</p>
            <p style="font-size: 14.5px; color: #374151; margin-top: 0;">
                Your food order <strong>#{order_id_display}</strong> has been successfully delivered! Enjoy your meal. 🍽️
            </p>
            
            <!-- Delivered Success Box -->
            <div style="text-align: center; margin: 20px 0; background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 18px 16px;">
                <div style="font-size: 32px; margin-bottom: 4px;">✅</div>
                <div style="font-size: 17px; font-weight: 800; color: #065f46;">Delivered to: {delivery_location}</div>
                <div style="font-size: 13px; color: #047857; margin-top: 4px;">Thank you for ordering with University Canteen!</div>
            </div>

            <!-- Itemized Order List -->
            <div style="margin-top: 20px;">
                <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; margin-bottom: 10px;">📋 Delivered Items</div>
                {items_list_html}
            </div>

            <!-- Total Amount Card -->
            <div style="margin-top: 14px; padding: 14px 16px; background: #111827; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; color: #ffffff;">
                <span style="font-size: 15px; font-weight: 600; color: #d1d5db;">Total Paid:</span>
                <span style="font-size: 20px; font-weight: 800; color: #34d399;">৳{total_amount:.2f}</span>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">University Canteen Food Delivery System<br>Sent to {to_email}</p>
        </div>
        """
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_email], msg.as_string())

        print(f"[ORDER DELIVERED EMAIL] Sent successfully to {to_email} for order #{order_id_display}")
        return True
    except Exception as e:
        print(f"[ORDER DELIVERED EMAIL ERROR] Failed sending to {to_email}: {e}")
        return False


def request_otp(email: str) -> dict:
    email_clean = email.strip().lower()
    if not email_clean or "@" not in email_clean or "." not in email_clean:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # Generate 4-digit OTP
    otp_code = str(random.randint(1000, 9999))
    _OTP_CACHE[email_clean] = {
        "otp": otp_code,
        "expires_at": time.time() + 300  # 5 minutes validity
    }

    sent_smtp = send_email_smtp(email_clean, otp_code)

    return {
        "message": f"4-digit OTP sent to {email_clean}",
        "email": email_clean,
        "sent_via_smtp": sent_smtp,
        "dev_otp": otp_code  # Helpful for immediate UI testing
    }


def verify_otp(email: str, otp: str) -> bool:
    email_clean = email.strip().lower()
    otp_clean = str(otp).strip()

    entry = _OTP_CACHE.get(email_clean)
    if not entry:
        return False

    if time.time() > entry["expires_at"]:
        _OTP_CACHE.pop(email_clean, None)
        return False

    if entry["otp"] == otp_clean:
        return True

    return False


def consume_otp(email: str, otp: str):
    """Verifies and removes the OTP from cache once used."""
    if not verify_otp(email, otp):
        raise HTTPException(status_code=400, detail="Invalid or expired 4-digit OTP. Please request a new code.")
    # Invalidate OTP after use
    _OTP_CACHE.pop(email.strip().lower(), None)
