UPDATE media_file SET mimetype='video/mp4' WHERE SUBSTRING(mimetype for 10) = 'video/mp4;';
UPDATE alternate_file SET mimetype='video/mp4' WHERE SUBSTRING(mimetype for 10) = 'video/mp4;';
