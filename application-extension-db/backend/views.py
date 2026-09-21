"""投递记录 CRUD 接口"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Application
import json


# ===== GET /api/applications/ — 查询所有 =====
@csrf_exempt
@require_http_methods(["GET"])
def list_applications(request):
    records = Application.objects.all().order_by('id')
    data = [
        {
            'id': r.id,
            'num': i + 1,
            'url': r.url,
            'company': r.company,
            'sent_position': r.sent_position,
            'unfilled_pos': r.unfilled_pos,
            'apply_date': r.apply_date.strftime('%m-%d') if r.apply_date else None,
            'date_raw': r.apply_date.strftime('%Y-%m-%d') if r.apply_date else None,
        }
        for i, r in enumerate(records)
    ]
    return JsonResponse({'code': 0, 'data': data})


# ===== GET /api/applications/<id>/ — 查询单条 =====
@csrf_exempt
@require_http_methods(["GET"])
def get_application(request, app_id: int):
    try:
        obj = Application.objects.get(id=app_id)
    except Application.DoesNotExist:
        return JsonResponse({'code': 1, 'msg': 'Not found'}, status=404)
    return JsonResponse({
        'code': 0,
        'data': {
            'id': obj.id,
            'url': obj.url,
            'company': obj.company,
            'sent_position': obj.sent_position,
            'unfilled_pos': obj.unfilled_pos,
            'apply_date': obj.apply_date.strftime('%m-%d'),
        }
    })


# ===== POST /api/applications/create/ — 新增 =====
@csrf_exempt
@require_http_methods(["POST"])
def create_application(request):
    body = json.loads(request.body)
    record = Application.objects.create(
        url=body.get('url', ''),
        company=body.get('company', ''),
        sent_position=body.get('sent_position', ''),
        unfilled_pos=body.get('unfilled_pos', ''),
        apply_date=body.get('apply_date'),
    )
    return JsonResponse({'code': 0, 'data': {'id': record.id}, 'msg': 'created'})


# ===== PUT /api/applications/update/<id>/ — 修改 =====
@csrf_exempt
@require_http_methods(["PUT"])
def update_application(request, app_id: int):
    try:
        obj = Application.objects.get(id=app_id)
    except Application.DoesNotExist:
        return JsonResponse({'code': 1, 'msg': 'Not found'}, status=404)
    body = json.loads(request.body)
    obj.url = body.get('url', obj.url)
    obj.company = body.get('company', obj.company)
    obj.sent_position = body.get('sent_position', obj.sent_position)
    obj.unfilled_pos = body.get('unfilled_pos', obj.unfilled_pos)
    if 'apply_date' in body:
        obj.apply_date = body['apply_date']
    obj.save()
    return JsonResponse({'code': 0, 'msg': 'updated'})


# ===== DELETE /api/applications/delete/<id>/ — 删除 =====
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_application(request, app_id: int):
    try:
        obj = Application.objects.get(id=app_id)
    except Application.DoesNotExist:
        return JsonResponse({'code': 1, 'msg': 'Not found'}, status=404)
    obj.delete()
    # 补位：让 id 保持连续（1,2,3 → 删2 → 剩1,3 → 变1,2）
    _repair_id_gaps()
    return JsonResponse({'code': 0, 'msg': 'deleted'})


def _repair_id_gaps():
    """删除后自动补位，保证 ID 从 1 开始连续"""
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SET @r = 0")
        cursor.execute(
            "UPDATE application SET id = (@r := @r + 1) ORDER BY id ASC"
        )
        cursor.execute(
            "SELECT COALESCE(MAX(id), 0) FROM application"
        )
        max_id = cursor.fetchone()[0] or 0
        cursor.execute(f"ALTER TABLE application AUTO_INCREMENT = {max_id + 1}")
