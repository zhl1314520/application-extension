# 使用官方 Python 3.10 的精简版 Linux 镜像作为基础环境
FROM python:3.10-slim

# 设置 3 个环境变量
# 不生成 .pyc 文件，.pyc 文件是 Python 的字节码文件，通常用于加快程序启动速度，但在开发环境中不需要生成这些文件
# 不要缓存标准输出, Django 的日志更及时地输出到 Docker 日志中
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MYSQL_HOST=mysql

# 设置工作目录为 /app，所有后续的命令都会在这个目录下执行
WORKDIR /app

COPY requirements.txt .
# 安装 python 依赖包，--no-cache-dir：pip 安装完以后不要保存 pip 的缓存
RUN pip install --no-cache-dir -r requirements.txt

# 将当前项目目录下的所有文件和文件夹复制到容器的 /app 目录下
# 默认情况下，COPY 命令会忽略 .dockerignore 文件内容
COPY . .

# 容器对外暴露 8000 端口，Django 默认使用 8000 端口运行开发服务器
EXPOSE 8000

# 容器启动命令，运行 Django 开发服务器，监听所有可用的网络接口
# 为什么不是 127.0.0.1？为了使得 Docker 外部能访问
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
