# Generated by Django 2.2.5 on 2019-10-12 05:29

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0011_update_proxy_permissions'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('is_staff', models.BooleanField(default=False, help_text='Designates whether the user can log into this admin site.', verbose_name='staff status')),
                ('is_active', models.BooleanField(default=True, help_text='Designates whether this user should be treated as active. Unselect this instead of deleting accounts.', verbose_name='active')),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now, verbose_name='date joined')),
                ('id', models.CharField(max_length=24, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('full_name', models.CharField(max_length=200)),
                ('had_catalog', models.BooleanField(default=False)),
                ('verified', models.BooleanField(default=False)),
                ('last_seen', models.DateTimeField(auto_now_add=True)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.Group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.Permission', verbose_name='user permissions')),
            ],
            options={
                'ordering': ['full_name'],
            },
        ),
        migrations.CreateModel(
            name='Access',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ],
        ),
        migrations.CreateModel(
            name='Album',
            fields=[
                ('id', models.CharField(max_length=24, primary_key=True, serialize=False)),
                ('stub', models.CharField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='Catalog',
            fields=[
                ('id', models.CharField(max_length=24, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='Storage',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ],
        ),
        migrations.CreateModel(
            name='Backblaze',
            fields=[
                ('storage_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='api.Storage')),
                ('key_id', models.CharField(max_length=30)),
                ('key', models.CharField(max_length=40)),
                ('bucket', models.CharField(max_length=50)),
                ('path', models.CharField(max_length=200)),
            ],
            bases=('api.storage',),
        ),
        migrations.CreateModel(
            name='Server',
            fields=[
                ('storage_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='api.Storage')),
            ],
            bases=('api.storage',),
        ),
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('catalog', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tags', to='api.Catalog')),
                ('parent', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='children', to='api.Tag')),
            ],
            options={
                'unique_together': {('catalog', 'parent', 'name')},
            },
        ),
        migrations.CreateModel(
            name='Media',
            fields=[
                ('id', models.CharField(max_length=24, primary_key=True, serialize=False)),
                ('processed', models.BooleanField()),
                ('longitude', models.FloatField(null=True)),
                ('latitude', models.FloatField(null=True)),
                ('taken', models.DateTimeField()),
                ('uploaded', models.DateTimeField(auto_now_add=True)),
                ('modified', models.DateTimeField(auto_now_add=True)),
                ('mimetype', models.CharField(max_length=50)),
                ('width', models.IntegerField()),
                ('height', models.IntegerField()),
                ('storage_id', models.CharField(max_length=200)),
                ('albums', models.ManyToManyField(related_name='media', to='api.Album')),
                ('catalog', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='media', to='api.Catalog')),
                ('tags', models.ManyToManyField(related_name='media', to='api.Tag')),
            ],
        ),
        migrations.AddField(
            model_name='catalog',
            name='storage',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='catalogs', to='api.Storage'),
        ),
        migrations.AddField(
            model_name='catalog',
            name='users',
            field=models.ManyToManyField(related_name='catalogs', through='api.Access', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='album',
            name='catalog',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='albums', to='api.Catalog'),
        ),
        migrations.AddField(
            model_name='album',
            name='parent',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='albums', to='api.Album'),
        ),
        migrations.AddField(
            model_name='access',
            name='catalog',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.Catalog'),
        ),
        migrations.AddField(
            model_name='access',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterUniqueTogether(
            name='album',
            unique_together={('catalog', 'parent', 'name')},
        ),
        migrations.AlterUniqueTogether(
            name='access',
            unique_together={('user', 'catalog')},
        ),
    ]
