"""投递记录数据模型 — 映射 application 表"""
from django.db import models


class Application(models.Model):
    """投递记录"""
    url = models.URLField(max_length=2048)
    company = models.CharField(max_length=255, default='')
    sent_position = models.CharField(max_length=128, default='')
    unfilled_pos = models.CharField(max_length=128, default='')
    apply_date = models.DateField()

    class Meta:
        db_table = 'application'
        ordering = ['-id']

    def __str__(self):
        return f"{self.company} — {self.sent_position}"
