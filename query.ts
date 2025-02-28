//region Types

//region Utilities

type CheckAndMerge<T extends any[], Acc = {}> = T extends [infer First, ...infer Rest]
    ? First extends object
        ? keyof First & keyof Acc extends never
            ? CheckAndMerge<Rest, Acc & First>
            : { error: `存在重复字段:   \){keyof First & keyof Acc}` }
        : CheckAndMerge<Rest, Acc>
    : Acc;

type Join<T extends any[]> = CheckAndMerge<T> extends infer Result
    ? Result extends { error: any } ? never : Result
    : never;
type RenameField<T, K extends keyof T, N extends string> = Omit<T, K> & {
    [P in K as N]: T[K];
}
type NonBlank<T extends string> = '' extends T ? never : T
//endregion

//region Model
type BaseEntity<T> = {
    -readonly [K in keyof T]:
    {} extends Pick<T, K> ? (
        T[K] extends number ? Field<number, K, T> & OptionalField
            : T[K] extends string ? Field<string, K, T> & OptionalField
                : T[K] extends boolean ? Field<boolean, K, T> & OptionalField
                    : T[K] extends Array<any> ? Field<Array<any>, K, T> & OptionalField
                        : T[K] extends Record<string, any> ? Field<Record<string, any>, K, T> & OptionalField
                            : never
        ) : (
        T[K] extends number ? Field<number, K, T>
            : T[K] extends string ? Field<string, K, T>
                : T[K] extends boolean ? Field<boolean, K, T>
                    : T[K] extends Array<any> ? Field<Array<any>, K, T>
                        : T[K] extends Record<string, any> ? Field<Record<string, any>, K, T>
                            : never
        )
}
type Alias<T> = {
    alias(name: string): Omit<T, 'alias'>
}
type Joiner<T extends BaseEntity<any>> = {
    join<R extends BaseEntity<any>>(r: R, cond: CondExpr): Join<[T, R]>
    cross<R extends BaseEntity<any>>(r: R, cond: CondExpr): Join<[T, R]>
    outer<R extends BaseEntity<any>>(r: R, cond: CondExpr): Join<[T, R]>
}
type Filter<T extends BaseEntity<any>> = {
    filter(fn: (e: T) => CondExpr): Omit<T, 'filter'>
}

type Entity<T> = BaseEntity<T> & Alias<BaseEntity<T>> & Joiner<BaseEntity<T>> & Filter<BaseEntity<T>>
//endregion

type AsyncExecutor<T> = {
    (sql: string): Promise<T>
}
type CondExpr = {
    and(e: boolean | CondExpr | Field<boolean, any, any>): CondExpr
    or(e: boolean | CondExpr | Field<boolean, any, any>): CondExpr
    not(): CondExpr
}
type SortExpr = {
    then(s: SortExpr): SortExpr
}

type Query<E> = {
    one(fn: AsyncExecutor<E>): Promise<E>
    any(fn: AsyncExecutor<Array<E>>): Promise<Array<E>>
    count(fn: AsyncExecutor<number>): Promise<number>

    sort(f: SortExpr): Omit<Query<E>, 'sort'>
    skip(f: number): Omit<Query<E>, 'skip'> & {
        limit(f: number): Omit<Query<E>, 'skip' | 'limit' | 'sort'>
    }
}


type OptionalField = {
    isNull(): CondExpr
    notNull(): CondExpr
}

type Field<V, K extends keyof T, T> = {
    alias<X extends string>(name: X): Entity<RenameField<T, K, X>>
} & {
    eq(v: V | Field<V, any, T>): CondExpr
    neq(v: V | Field<V, any, T>): CondExpr
} & {
    desc(): SortExpr
    asc(): SortExpr
}
    & (
    V extends boolean ? {
        isTrue(): CondExpr
        isFalse(): CondExpr
        not(): Field<boolean, K, T>
        and(v: Field<boolean, K, T> | boolean): Field<boolean, K, T>
        or(v: Field<boolean, K, T> | boolean): Field<boolean, K, T>
    } : {}
    )
    & (
    V extends number ? {
        plus(v: number | Field<number, K, T>): Field<number, K, T>
        minus(v: number | Field<number, K, T>): Field<number, K, T>
        times(v: number | Field<number, K, T>): Field<number, K, T>
        divide(v: number | Field<number, K, T>): Field<number, K, T>
        rem(v: number | Field<number, K, T>): Field<number, K, T>

        shr(v: number | Field<number, K, T>): Field<number, K, T>
        shl(v: number | Field<number, K, T>): Field<number, K, T>
        bitAnd(v: number | Field<number, K, T>): Field<number, K, T>
        bitOr(v: number | Field<number, K, T>): Field<number, K, T>
        bitNot(): Field<number, K, T>
        bitXor(v: number | Field<number, K, T>): Field<number, K, T>
    } : {}
    )
    & (
    V extends string ? {
        startsWith(v: NonBlank<string>): CondExpr
        endsWith(v: NonBlank<string>): CondExpr
        contains(v: NonBlank<string>): CondExpr
    } : {}
    )


//endregion
enum DL {
    JOIN, CROSS, OUTER
}

enum OP {
    EQ = "EQ"
}

const log = console.log

class TTable {
    constructor(
        public _table: string,
        public _fields: Record<string, TField> = {},
        public _alias: Record<string, TField> = {},
        public _proxy?: any,
        public _aliasName: string | null = null,
        public _lastExpr: Expr | null = null,
        public _join: { tab: TTable, cond: any }[] = []
    ) {

    }


    _field(name: string) {
        if (this._alias[name]) return this._alias[name]
        if (this._fields[name]) return this._fields[name]
        this._fields[name] = new TField(this, name)
        return this._fields[name]
    }

    _aliased(name: string, field: TField) {
        if (this._alias[name]) throw Error("alias " + name + " for " + field + " already exists to " + this._alias[name])
        this._alias[name] = field
    }

    public join(v: TTable, cond: TTable) {
        log('call join', this.toString(), v.toString())
        this._join.push({tab: v, cond: cond._lastExpr ?? v._lastExpr ?? this._lastExpr})
        if (cond._lastExpr) cond._lastExpr = undefined
        if (v._lastExpr) v._lastExpr = undefined
        if (this._lastExpr) this._lastExpr = undefined
        return this._proxy
    }

    _name() {
        return this._aliasName ?? this._table
    }

    public toString() {
        // console.log('alias', alias)
        // console.log(fields)
        const v = {
            table: this._table,
            alias: Object.keys(this._alias).filter(x => x.length > 0).reduce((o, k) => {
                // console.log(k, this._alias[k])
                o[k] = this._alias[k]?.toString() ?? ""
                return o
            }, {}),
            fields: Object.keys(this._fields).filter(x => x.length > 0).reduce((o, k) => {
                // console.log(k, this._fields[k])
                o[k] = this._fields[k]?.toString() ?? ""
                return o
            }, {}),
            joins: this._join.reduce((o, v) => {
                o[v.tab._name()] = v.cond.toString()
                return o
            }, {})
        }
        return JSON.stringify(v)
    }

}

type GeneralType = TField | Expr | number | string | boolean | Array<any> | Record<string, any>

class Expr {
    constructor(
        public op: OP,
        public left: GeneralType,
        public right?: GeneralType,
    ) {
    }

    public toString() {
        return `${this.op.toString()}(${this.left.toString()}${this.right ? "," + this.right.toString() : ""})`
    }
}

class TField {

    constructor(
        public _tab: TTable,
        public _name: string,
        public _alias?: string
    ) {

    }

    public alias(name: string) {
        log("call alias ", this, name)
        if (this._alias) throw Error("already have alias")
        this._alias = name
        this._tab._aliased(name, this)
        return this._tab._proxy
    }

    public eq(v: GeneralType) {
        log("call eq ", this, v)
        this._tab._lastExpr = new Expr(OP.EQ, this, v)
        return this._tab._proxy
    }


    public toString() {
        return this._tab._table + "." + (this._alias ? this._alias + "[" + this._name + "]" : this._name)
    }
}

function query<T extends Entry>(store: string): Entity<T> {
    const tab = new TTable(store)
    // @ts-ignore
    tab._proxy = new Proxy<Query<T>>(tab, {
        get(target: Query<T>, p: string | symbol, receiver: any): any {
            p = p.toString()
            if (tab[p]) return tab[p]
            if (p[0] === '_') return tab[p]
            return tab._field(p)
        }
    })
    return tab._proxy
}

interface Entry {
    id: number
}

interface Some extends Entry {
    id: number
    name: string
    some?: string
}

interface Some1 extends Entry {
    id: number
    name1: string
    some2?: string
}

const v = query<Some>('some')
const some1 = query<Some1>('some1')
const r = some1.id.alias('rid')
console.log('the alias table', some1.toString())
console.log('the alias field', r.rid.toString())
const u = v.join(r, r.rid.eq(v.id))
console.log(u.toString())
