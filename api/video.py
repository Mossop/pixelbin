import subprocess
import json
import os

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

def extract_poster(filename, target):
    args = [
        'ffmpeg',
        '-i', filename,
        '-frames:v', '1',
        '-q:v', '3',
        '-f', 'singlejpeg',
        target
    ]
    completed = subprocess.run(args, capture_output=True, encoding='utf-8')
    if completed.returncode < 0:
        raise Exception('Unexpected return code %d from ffmpeg.' % completed.returncode)
    if not os.path.exists(target):
        raise Exception('ffmpeg failed to extract an image: %s' % completed.stdout)
