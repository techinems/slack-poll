# Welcome to inorout
It appears as though you are in need of assistance.  A simple poll can be created
with
```
/inorout
Do you like DPS?
Yes
No
Only 540
```
If you want more answers, just insert them on a new line.

## Allowing for multiple answers
Suppose we want to know what day of the weekend people are good to party. Someone
might be free both Friday and Saturday.  Rather than create combinations of all 3 options
we instead can allow for people to select multiple choices using the `multiple` option.  That would look like
```
/inorout multiple
When should we go to Snowman's?
1800
1830
1900
```
Note we put our option on the same line as the command then on a new line we put our title.

##  Anonymous polls
There are some cases where we may want to allow for someone to vote without
revealing their identity. That can be accomplished with the `anon` option and
looks something like this.
```
/inorout anon
Who was a better 1st LT?
923
982
992
```
again, like with `multiple`, we put the option, `anon` on the same line as the command.

## Combining options
If you want to use multiple options, just put them on the same line separated by a space
i.e.
```
/inorout multiple anon
...
```
gives an anonymous poll where multiple answers are allowed. Order doesn't matter.
The current list of options are
```
multiple, anon, help
```
If you have a request for a new option, reach out in #dev!
