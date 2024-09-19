CREATE TABLE IF NOT EXISTS "client_error" (
    client text NOT NULL,
    request_time timestamp with time zone NOT NULL,
    status_code integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "client_error_idx" ON "client_error" USING btree ("client", "request_time");
