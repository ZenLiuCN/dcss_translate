package main

import (
	"bufio"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"flag"
	sqlx "github.com/jmoiron/sqlx"
	"io/fs"
	_ "modernc.org/sqlite"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"time"
)

const (
	MODE_IMPORT    = 0
	MODE_EXPORT    = 1
	MODE_TRANSLATE = 2
)

var (
	dbEn  string
	dbTS  string
	desEn string
	desTS string
	db    string
	addr  string
	mode  int
)

func main() {
	flag.IntVar(&mode, "e", 0, "mode: \n0 import to database (default); \n1 mode to txt files;\n2 edit with web")
	flag.StringVar(&dbEn, "d", "", "source folder of database eg: xxx\\dat\\database, required for import mode")
	flag.StringVar(&desEn, "s", "", "source folder of descript eg: xxx\\dat\\descript, required for import mode")
	flag.StringVar(&dbTS, "t", "", "translate folder of database eg: xxx\\dat\\database\\zh, required for export mode")
	flag.StringVar(&desTS, "r", "", "translate folder of descript eg: xxx\\dat\\descript\\zh, required for export mode")
	flag.StringVar(&db, "db", "./stone.db", "database path,default ./stone.db")
	flag.StringVar(&addr, "p", ":8080", "edit web address,default ':8080'")
	flag.Parse()
	switch mode {
	case MODE_EXPORT:
		b := false
		if len(dbTS) == 0 {
			println("missing -t")
			b = true
		}
		if len(desTS) == 0 {
			println("missing -r")
			b = true
		}
		if b {
			goto err
		}
	case MODE_IMPORT:
		b := false
		if len(dbEn) == 0 {
			println("missing -d")
			b = true
		}
		if len(desEn) == 0 {
			println("missing -s")
			b = true
		}
		if b {
			goto err
		}
	}
	switch mode {
	case MODE_EXPORT:
		exports()
	case MODE_IMPORT:
		imports()
	case MODE_TRANSLATE:
		edit()
	}
	return
err:
	println("mode(e): ", mode)
	println("source database (d): ", dbEn)
	println("source description (s): ", desEn)
	println("translate database (t): ", dbTS)
	println("translate description (r): ", desTS)
	println("database (db):", db)
	println("address (p):", addr)

	flag.Usage()
	os.Exit(-1)
}

var (
	LF = "\n"
)

func connect() *sqlx.DB {
	if runtime.GOOS == "windows" {
		LF = "\r\n"
	}
	conn := sqlx.MustOpen("sqlite", db)
	row := one(conn.Queryx("SELECT count(name) FROM sqlite_master WHERE type='table' AND name=$1", "names"))
	var n int
	if row.Next() {
		none(row.Scan(&n))
	}
	row.Close()
	if n == 0 {
		_ = one(conn.Exec("CREATE TABLE names (id INTEGER PRIMARY KEY AUTOINCREMENT,catalog text,topic text,line int,endline int,raw text,type text,eng text, trans text ,done bool default false)"))
	}
	return conn
}
func none(err error) {
	if err != nil {
		panic(err)
	}
}
func one[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

func exports() {
	conn := connect()
	{
		r := one(conn.Query("SELECT  count(*) from  names"))
		var n int
		if r.Next() {
			none(r.Scan(&n))
		}
		none(r.Close())
		if n == 0 {
			panic("already have no data in " + db)
		}
	}
	var out = make([]*Record, 0)
	none(conn.Select(&out, "SELECT * FROM names where eng!='' or raw !='' "))
	var sorted [2]map[string][]*Record
	sorted[0] = make(map[string][]*Record)
	sorted[1] = make(map[string][]*Record)
	for _, record := range out {
		var m map[string][]*Record
		switch record.Catalog {
		case CATALOG_DATABSE:
			m = sorted[0]
		case CATALOG_DESCRIPTION:
			m = sorted[1]
		}
		m[record.Topic] = append(m[record.Topic], record)
	}

	var files [2]map[string]*strings.Builder
	files[0] = make(map[string]*strings.Builder)
	files[1] = make(map[string]*strings.Builder)
	for _, m := range sorted {
		for _, records := range m {
			slices.SortFunc(records, func(a, b *Record) int {
				switch {
				case a.Line > b.Line:
					return 1
				case a.Line < b.Line:
					return -1
				default:
					return 0

				}
			})
			for _, record := range records {
				var cat map[string]*strings.Builder
				switch record.Catalog {
				case CATALOG_DATABSE:
					cat = files[0]
				case CATALOG_DESCRIPTION:
					cat = files[1]
				}
				var b = cat[record.Topic]
				if b == nil {
					b = new(strings.Builder)
					cat[record.Topic] = b
				}
				if record.Raw != "" {
					if record.Trans != "" {
						b.WriteString(record.Trans)
					} else {
						b.WriteString(record.Raw)
					}
					b.WriteRune('\n')
				} else {
					b.WriteString("%%%%")
					b.WriteRune('\n')
					b.WriteString(record.Type)
					b.WriteRune('\n')
					b.WriteRune('\n')
					if record.Trans == "" {
						b.WriteString(record.Eng)
					} else {
						b.WriteString(record.Trans)
					}
					b.WriteRune('\n')
				}

			}
		}
	}

	for name, text := range files[0] {
		none(os.WriteFile(filepath.Join(dbTS, name), []byte(strings.ReplaceAll(text.String(), "\n", LF)), os.ModePerm))
	}
	for name, text := range files[1] {
		none(os.WriteFile(filepath.Join(desTS, name), []byte(strings.ReplaceAll(text.String(), "\n", LF)), os.ModePerm))
	}
}
func edit() {
	conn := connect()
	var srv = new(Service)
	srv.Init(conn).Listen()
}

type Service struct {
	srv  *http.Server
	conn *sqlx.DB
	mux  *http.ServeMux
}

func (s *Service) Init(conn *sqlx.DB) *Service {
	s.conn = conn
	s.srv = &http.Server{Addr: addr}
	s.mux = http.NewServeMux()
	s.register()
	s.srv.Handler = s.mux
	return s
}
func (s *Service) Listen() {
	ch := make(chan os.Signal)
	signal.Notify(ch, os.Interrupt, os.Kill)
	go func() {
		for _ = range ch {
			ctx, cc := context.WithTimeout(context.Background(), time.Second)
			defer cc()
			s.srv.Shutdown(ctx)
			s.conn.Close()
			return
		}
	}()
	if err := s.srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		panic(err)
	}
}

//go:embed index.html
var html []byte

func (s *Service) register() {
	mux := s.mux
	page := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "text/html")
		w.Write(html)
	}
	mux.HandleFunc("GET /", page)
	mux.HandleFunc("GET /index.html", page)
	mux.HandleFunc("GET /entries/{catalog}/{topic}", onFailure(s.entries))
	mux.HandleFunc("POST /entry/{id}", onFailure(s.entry))
	mux.HandleFunc("POST /entry/{id}/done", onFailure(s.entryDone))
	mux.HandleFunc("OPTIONS /entry/{id}/done", onFailure(s.entry))
	mux.HandleFunc("OPTIONS /entry/{id}", onFailure(s.entry))
	mux.HandleFunc("GET /entries/", onFailure(s.catalogs))
}
func (s *Service) entry(w http.ResponseWriter, r *http.Request) {
	var data Record
	none(json.NewDecoder(r.Body).Decode(&data))
	_ = one(s.conn.Exec("UPDATE names SET trans=$1,done=false WHERE raw='' and id=$2 ", data.Trans, data.Id))
	w.WriteHeader(200)
}
func (s *Service) entryDone(w http.ResponseWriter, r *http.Request) {
	var data Record
	none(json.NewDecoder(r.Body).Decode(&data))
	_ = one(s.conn.Exec("UPDATE names SET trans=$1 , done=true WHERE id=$2 ", data.Trans, data.Id))
	w.WriteHeader(200)
}
func (s *Service) entries(w http.ResponseWriter, r *http.Request) {
	catalog := r.PathValue("catalog")
	topic := r.PathValue("topic")
	done := false
	if r.URL.Query().Has("done") {
		done = int(one(strconv.ParseInt(r.URL.Query().Get("done"), 10, 32))) > 0
	}
	page := 0
	size := 10
	if r.URL.Query().Has("page") {
		page = int(one(strconv.ParseInt(r.URL.Query().Get("page"), 10, 32)))
		page = page - 1
		if page < 0 {
			page = 0
		}
	}
	if r.URL.Query().Has("size") {
		size = int(one(strconv.ParseInt(r.URL.Query().Get("size"), 10, 32)))
		if size < 10 {
			size = 10
		}
	}
	var data []Record
	sql := "SELECT * FROM names where raw='' and eng!='' and catalog=$1 and topic=$2 order by id limit $3 offset $4"
	if done {
		sql = "SELECT * FROM names where raw='' and eng!=''  and catalog=$1 and topic=$2 and done=false order by id limit $3 offset $4"
	}
	none(s.conn.Select(&data, sql, catalog, topic, size, page*size))
	var m = json.NewEncoder(w)
	none(m.Encode(data))
}

type Info struct {
	Topic   string `db:"topic"`
	Catalog string `db:"catalog"`
	Done    int    `db:"done"`
	Total   int    `db:"total"`
}

func (s *Service) catalogs(w http.ResponseWriter, r *http.Request) {
	var topic []Info
	none(s.conn.Select(&topic, `
SELECT  catalog,  topic,  SUM(CASE WHEN done THEN 1 ELSE 0 END) as done,  COUNT(*) as total
FROM  names 
WHERE  raw = ''  and eng!='' 
GROUP BY catalog,  topic`))
	m := make(map[string][]map[string]any)
	for _, info := range topic {
		m[info.Catalog] = append(m[info.Catalog], map[string]any{
			"topic": info.Topic,
			"done":  info.Done,
			"total": info.Total,
		})
	}
	none(json.NewEncoder(w).Encode(m))
}

type Failure struct {
	Code int
	Err  error
}

func (f Failure) Error() string {
	return string(one(json.Marshal(map[string]any{
		"code":    f.Code,
		"message": f.Err.Error(),
	})))
}

var methods = http.MethodGet + "," +
	http.MethodHead + "," +
	http.MethodPost + "," +
	http.MethodPut + "," +
	http.MethodPatch + "," +
	http.MethodDelete + "," +
	http.MethodConnect + "," +
	http.MethodOptions + "," +
	http.MethodTrace

func cors(header http.Header, origin string) {
	if origin == "" {
		header.Add("Access-Control-Allow-Origin", "*")
	} else {
		header.Add("Access-Control-Allow-Origin", origin)
	}

	header.Add("Access-Control-Allow-Headers", "*")
	header.Add("Access-Control-Allow-Credentials", "true")
	header.Add("Access-Control-Allow-Methods", methods)
}
func onFailure(fn http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			switch x := recover().(type) {
			case nil:
			case Failure:
				w.WriteHeader(x.Code)
				_, _ = w.Write([]byte(x.Error()))
			case error:
				w.WriteHeader(500)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"code":    500,
					"message": x.Error(),
				})

			case string:
				w.WriteHeader(500)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"code":    500,
					"message": x,
				})
			}
		}()
		cors(w.Header(), "")
		if r.Method == http.MethodOptions {
			w.WriteHeader(200)
			return

		}
		fn(w, r)
	}
}

const (
	CATALOG_DATABSE     = "database"
	CATALOG_DESCRIPTION = "description"
)

//goland:noinspection SqlResolve
func imports() {
	conn := connect()
	{
		r := one(conn.Query("SELECT  count(*) from  names"))
		var n int
		if r.Next() {
			none(r.Scan(&n))
		}
		none(r.Close())
		if n > 0 {
			panic("already have data in " + db)
		}
	}
	m := make(map[string][]*Record)
	none(read(CATALOG_DATABSE, dbEn, m))
	none(read(CATALOG_DESCRIPTION, desEn, m))
	if len(dbTS) > 0 {
		none(merge(CATALOG_DATABSE, dbTS, m))
	}
	if len(desTS) > 0 {
		none(merge(CATALOG_DESCRIPTION, desTS, m))
	}
	stmt := conn.MustBegin()
	defer func() {
		if r := recover(); r != nil {
			none(stmt.Rollback())
			panic(r)
		} else {
			none(stmt.Commit())
		}
	}()

	for _, records := range m {
		//goland:noinspection SqlResolve
		one(stmt.NamedExec(`
INSERT INTO names(catalog,topic,line,endline,raw,type,eng,trans) 
VALUES (:catalog,:topic,:line,:endline,:raw,:type,:eng,:trans)
`, records))
	}

}
func read(catalog, p string, out map[string][]*Record) error {
	return walk(p, func(topic string, path string) {
		split(path, func(key string, b *strings.Builder, comment string, be, ed int) {
			if comment == "" {
				out[catalog] = append(out[catalog], &Record{

					Line:    be,
					EndLine: ed,
					Catalog: catalog,
					Topic:   topic,
					Type:    key,
					Eng:     b.String(),
				})
			} else {
				out[catalog] = append(out[catalog], &Record{

					Line:    be,
					EndLine: ed,
					Raw:     comment,
					Catalog: catalog,
					Topic:   topic,
				})
			}

		})
	})
}
func merge(catalog, p string, out map[string][]*Record) error {
	found := func(topic, key string) *Record {
		for _, record := range out[catalog] {
			if record.Type == key && record.Topic == topic {
				return record
			}
		}
		return nil
	}
	return walk(p, func(topic string, path string) {
		split(path, func(key string, b *strings.Builder, comment string, be, ed int) {
			if comment != "" {
				return
			}
			fn := found(topic, key)
			if fn != nil {
				fn.Trans = b.String()
			} else {
				out[catalog] = append(out[catalog], &Record{
					Line:    be,
					EndLine: ed,
					Catalog: catalog,
					Topic:   topic,
					Type:    key,
					Trans:   b.String(),
				})
			}
		})
	})
}
func walk(p string, onFile func(string, string)) error {
	return filepath.Walk(p, func(path string, info fs.FileInfo, err error) error {
		if p == path {
			return nil
		}
		if info.IsDir() {
			return filepath.SkipDir
		}
		if strings.HasSuffix(path, ".txt") {
			topic := info.Name()
			if topic == "FAQ.txt" {
				return nil
			}
			onFile(topic, path)
		}
		return nil
	})
}
func split(path string, onEntry func(key string, entry *strings.Builder, comment string, be, ed int)) {
	f := one(os.Open(path))
	defer func() {
		none(f.Close())
	}()
	r := bufio.NewScanner(f)
	key := ""
	b := new(strings.Builder)
	last := false
	be := 0
	ed := 0
	for r.Scan() {
		ed++
		line := r.Text()
		switch {
		case len(line) == 0:
			if b.Len() != 0 || (key != "" && !last) {
				b.WriteRune('\n')
			}
		case line[0] == '#':
			if key == "" || (len(line) > 1 && line[1] == '#') {
				onEntry(key, nil, line, be, ed)
				be = ed
			} else {
				last = false
				if b.Len() != 0 {
					b.WriteRune('\n')
				}
				b.WriteString(line)
			}
		case strings.EqualFold(line, "%%%%"):
			last = false
			if len(key) > 0 {
				onEntry(key, b, "", be, ed)
				b.Reset()
				key = ""
			}
			be = ed
		default:
			if len(key) == 0 {
				last = true
				key = line
			} else {
				last = false
				if b.Len() != 0 {
					b.WriteRune('\n')
				}
				b.WriteString(line)
			}
		}
	}
	if key != "" {
		onEntry(key, b, "", be, ed)
	}
}

type Record struct {
	Id      int    `db:"id" json:"id"`
	Line    int    `db:"line" json:"line"`
	EndLine int    `db:"endline" json:"endline"`
	Raw     string `db:"raw" json:"raw"`
	Catalog string `db:"catalog" json:"catalog"`
	Topic   string `db:"topic" json:"topic"`
	Type    string `db:"type" json:"type"`
	Eng     string `db:"eng" json:"eng"`
	Trans   string `db:"trans" json:"trans"`
	Done    bool   `db:"done" json:"done"`
}
