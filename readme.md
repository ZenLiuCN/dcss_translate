# Translation tool for [DCSS](https://github.com/crawl/crawl)

## Functions
1. parse database and descriptions of DCSS (except FAQ.txt),
Can also parse already translated text files, stored into SQLite database.
2. A Web Edit page to translate each parties.
3. Export translations from SQLite database to translation files

## Changes
1. Basic functions
2. Add LLM prompt generate and parse for translation.
    + At prompt text area put: `翻译以下DCSS游戏句子;
保留各行之间的只有1行空行和参数;
其中"w:数字"格式不进行更改;
"@"开始到最近一个"@"是参数, 不进行翻译;
按中文习惯调整参数的位置;
"----"为段落分隔应当单独输出为一个代码块;
最后检查有两个连续空行的替换为一个空行;
并按代码格式输出, 不需要解释过程.`
    + Choose a catalog and topic ,then click `Copy to Clipboard`
    + Parse to LLM 
    + Copy back core results, then click `Parse Transaction`
    + Check and `Save` or `Finish` each entry.