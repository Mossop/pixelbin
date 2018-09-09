import subprocess
import json
import os
import tempfile

def read_metadata(filename):
    args = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        filename
    ]
    completed = subprocess.run(args, capture_output=True, encoding='utf-8')
    if completed.returncode != 0:
        raise Exception('Unexpected return code %d from ffprobe.' % completed.returncode)

    result = json.loads(completed.stdout)
    videos = list(filter(lambda s: s['codec_type'] == 'video', result['streams']))
    if len(videos) != 1:
        raise Exception('Unexpected number of video streams.')

    return {
        'width': videos[0]['width'],
        'height': videos[0]['height'],
    }

def extract_poster(filename):
    (fd, temp_path) = tempfile.mkstemp()
    os.close(fd)

    args = [
        'ffmpeg',
        '-y',
        '-i', filename,
        '-frames:v', '1',
        '-q:v', '3',
        '-f', 'singlejpeg',
        temp_path
    ]
    completed = subprocess.run(args, capture_output=True, encoding='utf-8')
    if completed.returncode < 0:
        raise Exception('Unexpected return code %d from ffmpeg.' % completed.returncode)

    return temp_path
