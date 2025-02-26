
declare namespace vans {


    //region Van
    export interface State<T> {
        val: T
        readonly oldVal: T
        readonly rawVal: T
    }

    // Defining readonly view of State<T> for covariance.
    // Basically we want StateView<string> to implement StateView<string | number>
    export type StateView<T> = Readonly<State<T>>

    export type Val<T> = State<T> | T

    export type Primitive = string | number | boolean | bigint

    export type PropValue = Primitive | ((e: any) => void) | null

    export type PropValueOrDerived = PropValue | StateView<PropValue> | (() => PropValue)

    export type Props = Record<string, PropValueOrDerived> & { class?: PropValueOrDerived }

    export type PropsWithKnownKeys<ElementType> = Partial<{ [K in keyof ElementType]: PropValueOrDerived }>

    export type ValidChildDomValue = Primitive | Node | null | undefined

    export type BindingFunc = ((dom?: Node) => ValidChildDomValue) | ((dom?: Element) => Element)

    export type ChildDom =
        ValidChildDomValue
        | StateView<Primitive | null | undefined>
        | BindingFunc
        | readonly ChildDom[]

    export type TagFunc<Result> = (first?: Props & PropsWithKnownKeys<Result> | ChildDom, ...rest: readonly ChildDom[]) => Result

    export type Van = Readonly<{
        state: StateFunc
        derive: DeriveFunc
        add: AddFunc
        tags: TagsObject
        hydrate: HydrateFunc
    }>
    //endregion

//region types
    export type  Tags = Readonly<Record<string, TagFunc<Element>>> & {
        [K in keyof HTMLElementTagNameMap]: TagFunc<HTMLElementTagNameMap[K]>
    }
    export type StateFunc = <T>(init?: T) => State<T>
    export type DeriveFunc = <T>(f: () => T) => State<T>
    export type AddFunc = (dom: Element, ...children: readonly ChildDom[]) => Element
    export type TagsObject = Tags & ((namespaceURI: string) => Readonly<Record<string, TagFunc<Element>>>)
    export type HydrateFunc = <T extends Node>(dom: T, f: (dom: T) => T | null | undefined) => T
//region Basic
    export type Crc32Func = (v: string) => string
    export type Predicate = (v: any) => boolean
    export type PipeFunc = <T extends Func, U extends Func[], R extends Func>(...fns: [T, ...U, R]) => (...args: [...Parameters<T>]) => ReturnType<R>
    export type ComposeFunc = <T extends Func, U extends Func[], R extends Func>(...fns: [T, ...U, R]) => (...args: [...Parameters<T>]) => ReturnType<R>
    export type CurryFunc = (func: Function) => (...args: any[]) => any
    export type InjectStatus = 0 | 1 | 2
    export type StyleRefer = {
        shadow?: boolean //default is false
        name: string
        url: Url
    }
    export type Position = {
        left: number
        top: number
        behavior?: string
    }
    export type ElementPosition = {
        el?: Element, behavior?: string
    }
    export type Configurer = {
        shadow: boolean
    }
    export type Context = Units & {
        readonly conf: Readonly<Configurer>
        readonly components: { [key: Url]: Component }
        readonly modules: ModuleLoader
        readonly shared: ShareStates
        lookup(fn: FuncRefer): ScriptBindingFunc | ScriptStateFunc
        namespace(ns: string): Readonly<Record<string, TagFunc<Element>>>
        make(name: string, ns?: string): TagFunc<Element>
        may: DomAppender
    }
    export type Component = Readonly<{
        readonly context: Context | DeclareContext
        make(parent?: HTMLElement): Promise<ChildDom>
        unload(parents?: HTMLElement[]): Promise<void>
        init(parent?: HTMLElement): Promise<void>
    }>
    export type FuncComponent = {
        readonly context: Context
    } & Exclude<Component, 'context'>
    export type DeclareComponent = {
        readonly context: DeclareContext
    } & Exclude<Component, 'context'>
    export type ComponentFactory<T extends Component> = (ctx: Context) => Promise<T>
    export type Properties<T extends Element> = Props & PropsWithKnownKeys<T>
    export type PropertyBuilder<T extends Element> = ((...v: Properties<T>[]) => PropertyBuilder<T>) & { readonly build: Properties<T> }
    export type Func = (...args: any[]) => any
    export type CSSStyleDeclare = { selectorText: string, style: Partial<CSSStyleDeclaration> }
    export type StylerSheetBuilder = ((...v: CSSStyleDeclare[]) => StylerSheetBuilder) & { readonly    build: string }
    export type CssStyleDeclare = Partial<CSSStyleDeclaration>
    export type StyleBuilder = ((...v: CssStyleDeclare[]) => StyleBuilder) & { readonly build: string }
    export type HashId = string
    export type Url = string
    export type Identity = string
    export type ESModule = Readonly<Record<string, any>> & {
        readonly hashId: HashId
    }

    export type ModuleLoader = Readonly<{
        [key: Exclude<Url | Identity | HashId, 'use' | 'require'>]: ESModule
    }> & {
        use(name: Identity, code: string): Promise<ESModule>
        require(name: Identity, url: string): Promise<ESModule>
    }

    export type DomHelper = Readonly<{
        MuteEvent: (evt: Event) => boolean
        MuteInput: (evt: any) => boolean
        PreventDefault: <E extends Event>(fn: (evt: E) => any) => (evt: E) => any
        ReadOnlyEditable: (prop: Properties<any>) => Properties<any>
        clean: (el: Element) => void
        positionOf: (el: Element | undefined, offset: any) => Position
        root: (base?: string) => string
        scrollTo: (position: ElementPosition | Partial<Position>) => void
        injectStyle: (url, name: string, root?: ShadowRoot) => InjectStatus,
        uninjectStyle: (url, name: string, root?: ShadowRoot) => void,
        readonly position: Position
        readonly query: URLSearchParams
        readonly scrollWidth: number
        readonly isScrollVisible: boolean
        props: <T extends Element>(...args: Properties<T>[]) => PropertyBuilder<T>
        sheet: (...args: CSSStyleDeclare[]) => StylerSheetBuilder
        style: (...args: CssStyleDeclare[]) => StyleBuilder
        isBuilder: (v: any) => boolean
    }>
    export type Helper = Readonly<{
        crc32: Crc32Func
        isAsync: Predicate
        isState: Predicate
        pipe: PipeFunc
        compose: ComposeFunc
        curry: CurryFunc
    }>
    export type ComponentHelper = Readonly<{
        declare: DeclareComponentBuildFunc
        pack: FuncComponentBuildFunc
    }>
    export type CaseHelper = Readonly<{
        words: (s: string) => string[]
        kebab: (s: string) => string
        camel: (s: string) => string
        pascal: (s: string) => string
    }>

    export type LoaderBuildFunc = (cache?: Record<string, any>) => ModuleLoader
    export type ContextBuildFunc = (holder: Record<string, any>, conf?: Configurer, loader?: ModuleLoader) => Context
    export type DomAppender = (ch: ChildDom, p?: Element, shadow?: boolean) => Element | ChildDom
//endregion
//region VanX
    export type calc = <R>(f: () => R) => R
    export type reactive = <T extends object>(obj: T) => T
    export type noreactive = <T extends object>(obj: T) => T
    export type StateOf<T> = { readonly [K in keyof T]: State<T[K]> }
    export type stateFields = <T extends object>(obj: T) => StateOf<T>
    export type raw = <T extends object>(obj: T) => T
    export type ValueType<T> = T extends (infer V)[] ? V : T[keyof T]
    export type KeyType<T> = T extends unknown[] ? number : string
    export type list = <T extends object, ElementType extends Element> (container: (() => ElementType) | ElementType, items: T, itemFunc: (v: State<ValueType<T>>, deleter: () => void, k: KeyType<T>) => Node) => ElementType
    export type ReplacementFunc<T> = T extends (infer V)[] ? (items: V[]) => readonly V[] : (items: [string, T[keyof T]][]) => readonly [string, T[keyof T]][]
    export type replace = <T extends object>(obj: T, replacement: ReplacementFunc<T> | T) => T
    export type compact = <T extends object>(obj: T) => T

    export type VanX = Readonly<{
        raw: raw
        list: list
        stateFields: stateFields
        noreactive: noreactive
        reactive: reactive
        replace: replace
        compact: compact
        calc: calc
    }>

//endregion
//region States
    export type Reactive = Object
    export type AnyState = State<any> | Reactive

//endregion
//region Declare
    export type ScriptBindingFunc = (ctx: Context) => BindingFunc
    export type ScriptStateFunc = (ctx: Context) => AnyState
    export type SharedStateName = `$${string}`
    export type StateName = Exclude<string, SharedStateName>
    export type FuncName = string | `${string}.${string}`
    export type FuncRefer = `=>${FuncName}`
    export type BindingFuncReference = FuncRefer
    export type StateFuncReference = FuncRefer
    export type ShareStates = { [key: SharedStateName]: AnyState }
    export type TagName = keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap | string
    export type ModuleCode = string
    export type ModuleRefer = { name: string, url: Url | ModuleCode }
    export type ModuleSrc = ModuleCode | ModuleRefer
    export type Property = Record<keyof HTMLElement | string, any | BindingFuncReference>
    export type Tag = Readonly<{
        ns?: 'http://www.w3.org/2000/svg' | string,
        t: TagName
        p?: Property
        n?: (Tag | BindingFuncReference | any)[]
    }>
    export type Declare = Readonly<{
        //unique id
        i: string
        // ModuleCode may have two optional export function which used as component extra functions
        // init:(c:DeclareContext,parent?:Element)=>Promise(void)
        // unload:(c:DeclareContext,parents?:Element[])=>Promise(void)
        m?: ModuleSrc | ModuleSrc[]
        o?: Record<StateName, StateFuncReference | any>
        s?: Record<SharedStateName, StateFuncReference | any>
        c?: StyleRefer[]
        n: Tag
    }>
    export type Status = { owned: boolean, injected: boolean, instances: number }
    export type DeclareContext = Context & {
        readonly id: string
        readonly instances: DeclareContext[]
        readonly esm?: ESModule
        readonly own: Record<StateName, AnyState>
        readonly status: Readonly<Status>
        clone(own: Record<string, AnyState>): DeclareContext
        lookupRefer(fn: FuncRefer): ScriptBindingFunc | ScriptStateFunc
    }
    export type DeclareComponentBuildFunc = (d: string | Declare, ctx: Context) => Promise<DeclareComponent>
    export type FuncComponentBuildFunc = (
        dom: (c: Context, p?: Element) => Promise<ChildDom>,
        //invoke each time the component shows
        init: (c: Context, parent?: HTMLElement) => Promise<void>,
        //invoke when all components won't been used anymore.
        free: (c: Context, parents?: Element[]) => Promise<void>
    ) => ComponentFactory<FuncComponent>
//endregion
//region Router

    export type RouterAction = any
    export type Path = { pathname: string, search: string, hash: string }
    export type Locate<T = unknown> = { state: T, key: string } & Path
    export type RouterOption = Partial<{
        window: Window,
        //debug logging
        debug: boolean,
        //cache dom node for loaded pages
        cache: boolean,
        //primary source path or uri ,empty for current origin
        src: string,
        //common component source path or uri, empty for same as src
        common: string,
        //common component names
        commons: string[],
        //routing base , without '#' for hash mode
        base: string,
    }>
    export type To = string | Partial<Path>
    export type Router = {
        get action(): RouterAction
        get location(): Locate
        createHref(to: To): string
        createURL(to: To): URL
        encodeLocation(to: To): Path
        push(to: To, state?: any)
        replace(to: To, state?: any)
        go(n: number | undefined): void
        //close router
        close()
    }
    export type HistoryState<T = unknown> = {
        usr: T
        key: string
        idx: number
    }

    export type RouterHelper = Readonly<{
        /**
         * history mode router
         * @param option option of router
         * @param el element as root
         * @param ctx context
         */
        history(option: RouterOption, el: Element, ctx: Context): Promise<Router>
        /**
         * hash mode router
         * @param option option of router
         * @param el element as root
         * @param ctx context
         */
        hash(option: RouterOption, el: Element, ctx: Context): Promise<Router>
    }>

//endregion
    export type Units = Readonly<{
        dom: DomHelper
        cases: CaseHelper
        routing: RouterHelper
        loader: LoaderBuildFunc
        context: ContextBuildFunc
        factory: ComponentHelper
    }> & Helper & Van & VanX
//endregion

    //region Exposed
    //region van
    export const state: StateFunc
    export const derive: DeriveFunc
    export const add: AddFunc
    export const tags: TagsObject
    export const hydrate: HydrateFunc
    //endregion
    //region vanX
    export const calc: calc
    export const reactive: reactive
    export const noreactive: noreactive
    export const stateFields: stateFields
    export const raw: raw
    export const list: list
    export const replace: replace
    export const compact: compact
    //endregion

    export const crc32: Crc32Func
    export const isAsync: Predicate
    export const isState: Predicate
    export const pipe: PipeFunc
    export const compose: ComposeFunc
    export const curry: CurryFunc
    export const dom: DomHelper
    export const cases: CaseHelper
    export const routing: RouterHelper
    export const loader: LoaderBuildFunc
    export const context: ContextBuildFunc
    export const factory: ComponentHelper


    //endregion
}
export interface ValueRef<T>{
    get value():T
    get load():boolean
    val(v:T):ValueRef<T>
    done(v:T):ValueRef<T>
    loaded():ValueRef<T>
}
declare global {
    const vans:vans.Units
}
export {}
